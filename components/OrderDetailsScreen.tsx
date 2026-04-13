import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
    ArrowLeft, FileText, History, Paperclip, Download, Calendar,
    CheckCircle2, XCircle, Sparkles, PackageCheck, Landmark,
    FileSearch, ShoppingCart, Clock, MessageCircle, User as UserIcon,
    CheckCircle, AlertTriangle, Eye, ShieldCheck, MapPin,
    Building2, Briefcase, FileSignature, DollarSign, Fingerprint,
    Plus, Search, ChevronRight, Loader2
} from 'lucide-react';
import { Order, AppState, BlockType, Attachment, InventoryCategory, PurchaseAccount, User } from '../types';
import { addToInventory, savePurchaseOrder, updateOrderStatus } from '../services/comprasService';
import { purchaseAccountService } from '../services/purchaseAccountService';
import { formatLocalDate } from '../utils/dateUtils';

const HashIcon = ({ className }: { className?: string }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="4" y1="9" x2="20" y2="9"></line>
        <line x1="4" y1="15" x2="20" y2="15"></line>
        <line x1="10" y1="3" x2="8" y2="21"></line>
        <line x1="16" x2="14" y2="21"></line>
    </svg>
);

interface OrderDetailsScreenProps {
    order: Order;
    onBack: () => void;
    onDownloadPdf: (snapshot: AppState, blockType?: BlockType) => void;
    currentUser: User;
    onUpdateOrderStatus?: (orderOrId: string | Order, status: Order['status'], justification?: string) => Promise<void>;
}

type TabType = 'overview' | 'items' | 'justification' | 'history' | 'attachments' | 'signature' | 'conta';

export const OrderDetailsScreen: React.FC<OrderDetailsScreenProps> = ({
    order: initialOrder,
    onBack,
    onDownloadPdf,
    currentUser,
    onUpdateOrderStatus
}) => {
    const [order, setOrder] = useState<Order>(initialOrder);
    const [activeTab, setActiveTab] = useState<TabType>('overview');
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
    const [targetItemIndex, setTargetItemIndex] = useState<number | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<InventoryCategory | ''>('');
    const [isProcessing, setIsProcessing] = useState(false);

    // Account Modal States
    const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
    const [accounts, setAccounts] = useState<PurchaseAccount[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isCreatingAccount, setIsCreatingAccount] = useState(false);
    const [newAccountData, setNewAccountData] = useState({ account_number: '', description: '', sector: '', agency: '' });

    const content = order.documentSnapshot?.content;

    const handleMarkAsUntendered = (index: number) => {
        setTargetItemIndex(index);
        setIsCategoryModalOpen(true);
    };

    const confirmUntendered = async () => {
        if (targetItemIndex === null || !selectedCategory || !content?.purchaseItems) return;
        setIsProcessing(true);
        try {
            const item = content.purchaseItems[targetItemIndex];

            // 1. Add to Inventory
            await addToInventory({
                name: item.name,
                brand: item.brand,
                details: item.details,
                quantity: item.quantity,
                unit: item.unit,
                category: selectedCategory as InventoryCategory,
                is_tendered: false,
                original_order_protocol: order.protocol,
                original_item_id: item.id
            });

            // 2. Update Order content locally
            const updatedItems = [...content.purchaseItems];
            updatedItems[targetItemIndex] = {
                ...item,
                isTendered: false,
                category: selectedCategory as InventoryCategory
            };

            // 3. Save Order
            const updatedOrder: Order = {
                ...order,
                documentSnapshot: {
                    ...order.documentSnapshot!,
                    content: {
                        ...order.documentSnapshot!.content,
                        purchaseItems: updatedItems
                    }
                }
            };

            await savePurchaseOrder(updatedOrder);

            setIsCategoryModalOpen(false);
            setTargetItemIndex(null);
            setSelectedCategory('');
        } catch (error) {
            console.error("Error marking item as untendered:", error);
            alert('Ocorreu um erro ao processar o item. Tente novamente.');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleSelectAccount = async (account: PurchaseAccount) => {
        setIsProcessing(true);
        try {
            const accountStr = `${account.account_number} – ${account.description}`;

            // 1. Update order content
            const updatedOrder: Order = {
                ...order,
                documentSnapshot: {
                    ...order.documentSnapshot!,
                    content: {
                        ...order.documentSnapshot!.content,
                        selectedAccount: accountStr
                    }
                }
            };

            // 2. Add history movement
            const newMovement = {
                statusLabel: 'Conta Vinculada',
                date: new Date().toISOString(),
                userName: currentUser.name || 'Sistema',
                justification: `Dotação Orçamentária ${account.account_number} selecionada para este pedido.`
            };
            updatedOrder.statusHistory = [...(order.statusHistory || []), newMovement];

            // 3. Save to Supabase
            await savePurchaseOrder(updatedOrder);

            setOrder(updatedOrder);
            setIsAccountModalOpen(false);
        } catch (error) {
            console.error("Error selecting account:", error);
            alert("Erro ao vincular conta.");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleApproveAccount = async () => {
        if (!onUpdateOrderStatus) return;
        setIsProcessing(true);
        try {
            await onUpdateOrderStatus(order, 'approved', 'Dotação Orçamentária conferida e aprovada pela administração.');
            setOrder(prev => ({ ...prev, status: 'approved' }));
        } catch (error) {
            console.error("Error approving account:", error);
            alert("Erro ao aprovar dotação orçamentária.");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleCreateAccount = async () => {
        if (!newAccountData.account_number || !newAccountData.description) {
            alert("Preencha o número e a descrição da conta.");
            return;
        }
        setIsProcessing(true);
        try {
            const created = await purchaseAccountService.requestAccount({
                account_number: newAccountData.account_number,
                agency: newAccountData.agency || '0001',
                description: newAccountData.description,
                sector: newAccountData.sector || content?.requesterSector || 'Geral'
            });

            if (created) {
                // Auto-approve since this is an admin/manager flow
                await purchaseAccountService.approveAccount(created.id);
                await handleSelectAccount({ ...created, status: 'Ativa' });
                setIsCreatingAccount(false);
                setNewAccountData({ account_number: '', description: '', sector: '', agency: '' });
            }
        } catch (error) {
            console.error("Error creating account:", error);
            alert("Erro ao criar nova conta.");
        } finally {
            setIsProcessing(false);
        }
    };

    // Helper to render History Tab Content
    const renderHistory = () => (
        <div className="relative p-4 w-full">
            <div className="absolute left-[39px] desktop:left-[55px] top-6 bottom-6 w-0.5 bg-slate-200/60"></div>
            <div className="space-y-8 relative">
                {order.statusHistory && order.statusHistory.length > 0 ? (
                    [...order.statusHistory].reverse().map((move, idx) => (
                        <div key={idx} className="relative pl-16 desktop:pl-20 group animate-fade-in" style={{ animationDelay: `${idx * 50}ms` }}>
                            <div className={`absolute left-4 desktop:left-8 top-0 w-12 h-12 rounded-2xl border-4 border-white shadow-sm flex items-center justify-center z-10 transition-transform group-hover:scale-110 ${idx === 0
                                ? (move.statusLabel.includes('Cancela') || move.statusLabel.includes('Rejeição') ? 'bg-rose-50 text-rose-600' : move.statusLabel.includes('Aprova') ? 'bg-emerald-50 text-emerald-600' : 'bg-indigo-600 text-white')
                                : 'bg-white text-slate-400 border-slate-100 shadow-sm'
                                }`}>
                                {move.statusLabel.includes('Aprova') ? <CheckCircle2 className="w-5 h-5" /> :
                                    (move.statusLabel.includes('Cancela') || move.statusLabel.includes('Rejeição')) ? <XCircle className="w-5 h-5" /> :
                                        move.statusLabel.includes('Criação') ? <Sparkles className="w-5 h-5" /> :
                                            move.statusLabel.includes('Recebido') ? <PackageCheck className="w-5 h-5" /> :
                                                move.statusLabel.includes('Dotação') ? <Landmark className="w-5 h-5" /> :
                                                    move.statusLabel.includes('Orçamento') ? <FileSearch className="w-5 h-5" /> :
                                                        move.statusLabel.includes('Concluído') ? <CheckCircle className="w-5 h-5" /> :
                                                            move.statusLabel.includes('Realizado') ? <ShoppingCart className="w-5 h-5" /> :
                                                                <Clock className="w-5 h-5" />}
                            </div>
                            <div className={`p-6 rounded-[20px] border transition-all ${idx === 0
                                ? (move.statusLabel.includes('Cancela') || move.statusLabel.includes('Rejeição') ? 'bg-rose-50/50 border-rose-100' : 'bg-white border-indigo-100 shadow-md shadow-indigo-100/20')
                                : 'bg-white border-slate-100 hover:border-slate-200 hover:shadow-sm'
                                }`}>
                                <div className="flex flex-col desktop:flex-row desktop:items-center justify-between gap-2 mb-3">
                                    <h4 className={`text-sm font-black uppercase tracking-wider ${idx === 0 ? (move.statusLabel.includes('Cancela') || move.statusLabel.includes('Rejeição') ? 'text-rose-900' : 'text-indigo-900') : 'text-slate-700'
                                        }`}>
                                        {move.statusLabel}
                                    </h4>
                                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-1 rounded-lg border border-slate-100 self-start desktop:self-auto">
                                        <Calendar className="w-3 h-3" />
                                        {new Date(move.date).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                </div>

                                {move.justification && (
                                    <div className={`mb-4 p-4 rounded-2xl border flex items-start gap-3 ${move.statusLabel.includes('Cancela') || move.statusLabel.includes('Rejeição') ? 'bg-rose-100/20 border-rose-200/50 text-rose-800' : 'bg-slate-50 border-slate-200/50 text-slate-600'
                                        }`}>
                                        <div className="mt-0.5"><MessageCircle className="w-3.5 h-3.5 opacity-50" /></div>
                                        <div>
                                            <p className="text-[9px] font-black uppercase tracking-widest opacity-50 mb-1">Observação</p>
                                            <p className="text-xs font-medium leading-relaxed">{move.justification}</p>
                                        </div>
                                    </div>
                                )}

                                <div className="flex items-center gap-2 pt-2 border-t border-slate-50">
                                    <div className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500">
                                        <UserIcon className="w-3.5 h-3.5" />
                                    </div>
                                    <span className="text-xs font-bold text-slate-500">
                                        Responsável: <span className="text-slate-700">{move.userName || 'Sistema'}</span>
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                            <Clock className="w-10 h-10 text-slate-300" />
                        </div>
                        <p className="text-base font-bold text-slate-500">Nenhum histórico</p>
                    </div>
                )}
            </div>
        </div>
    );

    // Helper to render Signature Tab Content
    const renderSignature = () => {
        const signatureName = content?.signatureName || content?.requesterName || 'Não identificado';
        const signatureRole = content?.signatureRole || content?.requesterRole || 'Cargo não informado';
        const signatureSector = content?.signatureSector || content?.requesterSector || 'Setor não informado';
        const signatureDate = order.createdAt; // Assuming creation date is the signature date for the initial request
        const signatureHash = order.id.replace(/-/g, '').toUpperCase().slice(0, 16);

        return (
            <div className="p-4 desktop:p-8 w-full animate-fade-in">
                <div className="max-w-2xl mx-auto">
                    <div className="bg-white border border-slate-200 rounded-[2.5rem] shadow-2xl shadow-slate-200/50 overflow-hidden relative group">
                        {/* Decorative Background Elements */}
                        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50/50 rounded-bl-full -mr-16 -mt-16 transition-transform group-hover:scale-110"></div>
                        <div className="absolute bottom-0 left-0 w-24 h-24 bg-emerald-50/50 rounded-tr-full -ml-12 -mb-12 transition-transform group-hover:scale-110"></div>

                        <div className="relative p-8 desktop:p-12 flex flex-col items-center text-center">
                            {/* Validation Badge */}
                            <div className="mb-8 relative">
                                <div className="absolute inset-0 bg-indigo-500 rounded-full blur-2xl opacity-20 animate-pulse"></div>
                                <div className="relative w-24 h-24 bg-indigo-600 rounded-3xl rotate-12 flex items-center justify-center shadow-xl shadow-indigo-200">
                                    <ShieldCheck className="w-12 h-12 text-white -rotate-12" />
                                </div>
                                <div className="absolute -bottom-2 -right-2 bg-emerald-500 text-white p-2 rounded-xl shadow-lg border-2 border-white">
                                    <CheckCircle className="w-4 h-4" />
                                </div>
                            </div>

                            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-2">Assinatura Digital Validada</h3>
                            <div className="w-12 h-1 bg-indigo-100 rounded-full mb-8"></div>

                            {/* Signature Content */}
                            <div className="space-y-1 mb-10">
                                <p className="text-3xl desktop:text-4xl font-black text-slate-800 tracking-tight italic font-serif">
                                    {signatureName}
                                </p>
                                <div className="flex items-center justify-center gap-2 text-slate-400">
                                    <span className="text-xs font-bold uppercase tracking-widest">{signatureRole}</span>
                                    <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
                                    <span className="text-xs font-bold uppercase tracking-widest">{signatureSector}</span>
                                </div>
                            </div>

                            {/* Footer Metadata */}
                            <div className="grid grid-cols-1 desktop:grid-cols-2 gap-4 w-full pt-8 border-t border-slate-50">
                                <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100/50">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">Data e Hora do Registro</span>
                                    <div className="flex items-center justify-center gap-2 font-mono text-xs font-bold text-slate-600">
                                        <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                                        {new Date(signatureDate).toLocaleString('pt-BR')}
                                    </div>
                                </div>
                                <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100/50">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">Chave de Autenticidade (Hash)</span>
                                    <div className="flex items-center justify-center gap-2 font-mono text-[10px] font-bold text-indigo-600 bg-white px-2 py-1 rounded-lg border border-indigo-50">
                                        <Fingerprint className="w-3.5 h-3.5" />
                                        {signatureHash}
                                    </div>
                                </div>
                            </div>

                            {/* Verification Label */}
                            <div className="mt-8 flex items-center gap-3 px-6 py-2 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100 animate-fade-in">
                                <Sparkles className="w-4 h-4" />
                                <span className="text-[10px] font-black uppercase tracking-widest">Documento Assinado Digitalmente</span>
                            </div>
                        </div>
                    </div>

                    <p className="mt-6 text-center text-[10px] text-slate-400 font-medium px-8 leading-relaxed">
                        Esta assinatura é vinculada à conta autenticada do sistema e protegida por mútla autenticação de fatores (MFA),
                        garantindo a irretratabilidade e integridade deste documento conforme os padrões de segurança institucional.
                    </p>
                </div>
            </div>
        );
    };

    // Helper to render Account (Conta) Tab Content
    const renderConta = () => {
        const selectedAccount = order.documentSnapshot?.content?.selectedAccount;
        const isAdmin = currentUser.role === 'admin';
        const isWaitingAccountApproval = order.status === 'payment_account';

        let accountNumber = "Não Informada";
        let accountDescription = "Nenhuma dotação orçamentária vinculada a este pedido.";

        if (selectedAccount) {
            const parts = selectedAccount.split(' – ');
            if (parts.length >= 2) {
                accountNumber = parts[0];
                accountDescription = parts[1];
            } else {
                accountDescription = selectedAccount;
            }
        }

        return (
            <div className="w-full h-full flex flex-col p-4 desktop:p-8 animate-fade-in bg-slate-50/50 overflow-hidden">
                <div className="max-w-6xl mx-auto w-full h-full flex flex-col lg:flex-row items-stretch gap-6 lg:gap-8">

                    {/* Visual Card Block */}
                    <div className="flex-[1.2] flex flex-col justify-center gap-6">
                        <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-[0_30px_90px_-20px_rgba(0,0,0,0.1)] overflow-hidden transition-all duration-500 hover:shadow-[0_40px_100px_-20px_rgba(0,0,0,0.15)] flex flex-col h-fit">
                            <div className="h-2 bg-gradient-to-r from-indigo-600 via-indigo-500 to-indigo-400"></div>
                            <div className="p-8 desktop:p-12 flex flex-col gap-8">
                                <div className="flex items-center justify-between">
                                    <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center shadow-inner">
                                        <Landmark className="w-7 h-7 text-indigo-600" />
                                    </div>
                                    <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border flex items-center gap-2 ${selectedAccount ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'
                                        }`}>
                                        <div className={`w-2 h-2 rounded-full animate-pulse ${selectedAccount ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
                                        {selectedAccount ? "Dotação Vinculada" : "Pendente de Vínculo"}
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Número da Conta/Dotação</span>
                                            <div className="h-px flex-1 bg-slate-100"></div>
                                        </div>
                                        <div className="bg-slate-50 rounded-2xl py-6 px-8 border border-slate-200/60 shadow-inner group transition-all">
                                            <p className="text-3xl desktop:text-4xl font-black text-slate-900 tracking-tighter font-mono group-hover:text-indigo-600 transition-colors">
                                                {accountNumber}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Descrição Orçamentária</span>
                                            <div className="h-px flex-1 bg-slate-100"></div>
                                        </div>
                                        <div className="min-h-[100px] flex items-center">
                                            <p className="text-lg desktop:text-xl font-bold text-slate-700 leading-snug">
                                                {accountDescription}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-8 border-t border-slate-50 flex items-center justify-between text-[9px] font-black uppercase tracking-[0.3em] text-slate-300">
                                    <span>Sistema de Dotação Integrada</span>
                                    <div className="flex gap-1">
                                        <div className="w-1.5 h-1.5 rounded-full bg-slate-200"></div>
                                        <div className="w-1.5 h-1.5 rounded-full bg-slate-100"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Action & Status Block */}
                    <div className="flex-1 flex flex-col justify-center gap-6">
                        <div className="space-y-6">
                            <div className="bg-white/60 backdrop-blur-md p-8 rounded-[2rem] border border-white shadow-xl flex flex-col gap-6">
                                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-3">
                                    <ShieldCheck className="w-5 h-5 text-indigo-600" />
                                    Status de Aprovação
                                </h3>

                                <div className="space-y-4">
                                    <div className={`p-5 rounded-2xl border-2 flex items-start gap-4 transition-all ${order.status === 'approved' ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-100 opacity-60'
                                        }`}>
                                        <CheckCircle2 className={`w-6 h-6 shrink-0 ${order.status === 'approved' ? 'text-emerald-500' : 'text-slate-300'}`} />
                                        <div className="space-y-1">
                                            <p className={`text-xs font-black uppercase tracking-widest ${order.status === 'approved' ? 'text-emerald-900' : 'text-slate-400'}`}>Dotação Aprovada</p>
                                            <p className="text-[10px] font-medium text-slate-500 leading-relaxed">A dotação foi conferida e o processo pode seguir para a próxima etapa.</p>
                                        </div>
                                    </div>

                                    <div className={`p-5 rounded-2xl border-2 flex items-start gap-4 transition-all ${isWaitingAccountApproval ? 'bg-indigo-50 border-indigo-200 shadow-md shadow-indigo-500/5' : 'bg-slate-50 border-slate-100 opacity-60'
                                        }`}>
                                        <Clock className={`w-6 h-6 shrink-0 ${isWaitingAccountApproval ? 'text-indigo-600' : 'text-slate-300'}`} />
                                        <div className="space-y-1">
                                            <p className={`text-xs font-black uppercase tracking-widest ${isWaitingAccountApproval ? 'text-indigo-900' : 'text-slate-400'}`}>Aguardando Conferência</p>
                                            <p className="text-[10px] font-medium text-slate-500 leading-relaxed">A conta foi informada e aguarda a validação da administração.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Approval Controls */}
                            {isAdmin && isWaitingAccountApproval && (
                                <div className="animate-fade-in space-y-4">
                                    <div className="p-6 bg-slate-900 rounded-[2rem] shadow-2xl flex flex-col gap-6 overflow-hidden relative group">
                                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-125 transition-transform">
                                            <Landmark className="w-24 h-24" />
                                        </div>
                                        <div className="relative z-10 space-y-2">
                                            <h4 className="text-white font-black uppercase tracking-widest text-[11px]">Ações do Administrador</h4>
                                            <p className="text-slate-400 text-[10px] font-medium leading-relaxed">Confirme se a dotação orçamentária informada no pedido está correta.</p>
                                        </div>
                                        <div className="flex gap-3 relative z-10">
                                            <button
                                                onClick={handleApproveAccount}
                                                disabled={isProcessing || !selectedAccount}
                                                className="flex-1 py-4 bg-emerald-500 text-white rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                                            >
                                                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                                                Aprovar Dotação
                                            </button>
                                            <button
                                                onClick={async () => {
                                                    const fetched = await purchaseAccountService.getAccounts();
                                                    setAccounts(fetched);
                                                    setIsAccountModalOpen(true);
                                                }}
                                                className="py-4 px-6 bg-white/10 text-white border border-white/20 rounded-2xl font-black uppercase tracking-widest text-[11px] transition-all flex items-center justify-center gap-2 hover:bg-white/20 active:scale-95"
                                                title="Alterar Dotação"
                                            >
                                                Alterar
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {!isAdmin && isWaitingAccountApproval && (
                                <div className="p-6 bg-indigo-600 rounded-[2rem] shadow-lg flex items-center gap-4 animate-pulse">
                                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-white">
                                        <Clock className="w-6 h-6" />
                                    </div>
                                    <div className="space-y-0.5">
                                        <p className="text-white font-black uppercase tracking-widest text-[10px]">Análise Pendente</p>
                                        <p className="text-white/70 text-[9px] font-medium italic">Aguardando aprovação administrativa da dotação.</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // Helper to render Attachments Tab Content
    const renderAttachments = () => (
        <div className="p-4 w-full">
            {order.attachments && order.attachments.length > 0 ? (
                <div className="grid grid-cols-1 desktop:grid-cols-2 gap-4">
                    {order.attachments.map(att => (
                        <div key={att.id} className="group relative bg-white p-4 rounded-2xl border border-slate-200 hover:border-indigo-300 hover:shadow-lg hover:shadow-indigo-500/10 transition-all duration-300">
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform group-hover:bg-indigo-600 group-hover:text-white text-indigo-500">
                                    <FileText className="w-6 h-6" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-bold text-slate-800 text-sm truncate mb-1 pr-8" title={att.name}>{att.name}</h4>
                                    <div className="flex items-center gap-2 text-[10px] font-medium text-slate-400 uppercase tracking-wide">
                                        <span className="bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">{att.type.split('/')[1] || 'FILE'}</span>
                                        <span>•</span>
                                        <span>{formatLocalDate(att.date)}</span>
                                    </div>
                                </div>
                            </div>
                            <a
                                href={att.url}
                                target="_blank"
                                rel="noreferrer"
                                className="absolute right-4 top-4 w-8 h-8 flex items-center justify-center bg-slate-50 hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 rounded-lg border border-slate-100 hover:border-emerald-200 transition-all"
                                title="Visualizar Anexo"
                            >
                                <Eye className="w-4 h-4" />
                            </a>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                    <div className="w-20 h-20 bg-slate-50 rounded-[2rem] flex items-center justify-center mb-6 shadow-xl shadow-slate-200/50">
                        <Paperclip className="w-10 h-10 text-slate-300" />
                    </div>
                    <p className="text-lg font-black text-slate-800 uppercase tracking-widest mb-1">Sem anexos vinculados</p>
                    <p className="text-xs text-slate-400 font-medium">Nenhum arquivo digital foi anexado a este processo.</p>
                </div>
            )}
        </div>
    );

    const renderOverview = () => (
        <div className="p-4 desktop:p-6 w-full animate-fade-in overflow-hidden">
            <div className="max-w-5xl mx-auto space-y-4">
                {/* Main Info Block: Title only */}
                <div className="bg-white border border-slate-100 rounded-[2rem] shadow-sm border-l-4 border-l-indigo-500 overflow-hidden">
                    <div className="p-5 desktop:p-6">
                        <span className="text-[10px] uppercase font-black tracking-[0.2em] text-slate-400 mb-1.5 block">Objeto / Título do Pedido</span>
                        <h2 className="text-xl desktop:text-2xl font-black text-slate-800 leading-tight">
                            {order.title || 'Detalhes do Pedido'}
                        </h2>
                    </div>
                </div>

                {/* Status & Protocol Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-start gap-3 group hover:border-indigo-200 transition-all">
                        <div className="p-2 bg-indigo-50 text-indigo-500 rounded-xl group-hover:bg-indigo-600 group-hover:text-white transition-colors shrink-0">
                            <HashIcon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                            <span className="text-[9px] uppercase font-black tracking-widest text-slate-400 block mb-1">Protocolo Interno</span>
                            <span className="font-mono text-xs font-black text-indigo-600 bg-indigo-50/50 px-2.5 py-1 rounded-lg border border-indigo-100 uppercase">
                                {order.protocol}
                            </span>
                        </div>
                    </div>

                    <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-start gap-3 group hover:border-indigo-200 transition-all">
                        <div className="p-2 bg-slate-50 text-slate-400 rounded-xl group-hover:bg-indigo-600 group-hover:text-white transition-colors shrink-0">
                            <ShieldCheck className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                            <span className="text-[9px] uppercase font-black tracking-widest text-slate-400 block mb-1">Situação do Processo</span>
                            {order.status === 'approved' && <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100 uppercase tracking-wide flex items-center gap-1.5 w-fit"><CheckCircle2 className="w-3 h-3" /> Aprovado</span>}
                            {order.status === 'pending' && <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200 uppercase tracking-wide flex items-center gap-1.5 w-fit"><Clock className="w-3 h-3" /> Pendente</span>}
                            {order.status === 'rejected' && <span className="text-[9px] font-bold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-100 uppercase tracking-wide flex items-center gap-1.5 w-fit"><XCircle className="w-3 h-3" /> Rejeitado</span>}
                            {order.status === 'payment_account' && (
                                <button
                                    onClick={async () => {
                                        setIsProcessing(true);
                                        const fetched = await purchaseAccountService.getAccounts();
                                        setAccounts(fetched);
                                        setIsAccountModalOpen(true);
                                        setIsProcessing(false);
                                    }}
                                    className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-200 uppercase tracking-wide flex items-center gap-1.5 w-fit hover:bg-indigo-600 hover:text-white transition-all animate-pulse"
                                >
                                    <Landmark className="w-3 h-3" /> Conta de Pagamento
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Secondary Info Block */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Solicitante */}
                    <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-start gap-3 group hover:border-indigo-200 transition-all">
                        <div className="p-2 bg-indigo-50 text-indigo-500 rounded-xl group-hover:bg-indigo-600 group-hover:text-white transition-colors shrink-0">
                            <UserIcon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                            <span className="text-[9px] uppercase font-black tracking-widest text-slate-400 block mb-0.5">Solicitante</span>
                            <div className="text-sm font-black text-slate-800 truncate">{content?.requesterName || '---'}</div>
                            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter truncate">{content?.requesterRole || 'Cargo não informado'}</div>
                        </div>
                    </div>

                    {/* Setor */}
                    <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-start gap-3 group hover:border-indigo-200 transition-all">
                        <div className="p-2 bg-indigo-50 text-indigo-500 rounded-xl group-hover:bg-indigo-600 group-hover:text-white transition-colors shrink-0">
                            <Building2 className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                            <span className="text-[9px] uppercase font-black tracking-widest text-slate-400 block mb-0.5">Setor</span>
                            <div className="text-sm font-black text-slate-800 truncate">{content?.requesterSector || '---'}</div>
                        </div>
                    </div>

                    {/* Datas */}
                    <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-start gap-3 group hover:border-emerald-200 transition-all">
                        <div className="p-2 bg-emerald-50 text-emerald-500 rounded-xl group-hover:bg-emerald-600 group-hover:text-white transition-colors shrink-0">
                            <Calendar className="w-4 h-4" />
                        </div>
                        <div className="flex-1 grid grid-cols-2 gap-2">
                            <div>
                                <span className="text-[9px] uppercase font-black tracking-widest text-slate-400 block mb-0.5">Abertura</span>
                                <div className="text-sm font-black text-slate-800">
                                    {new Date(order.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                                </div>
                            </div>
                            <div>
                                <span className="text-[9px] uppercase font-black tracking-widest text-slate-400 block mb-0.5">Previsão</span>
                                <div className="text-sm font-black text-slate-800">
                                    {formatLocalDate(order.completionForecast)}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Discreet Validation Footer */}
                <div className="flex items-center justify-between px-4 opacity-40 grayscale hover:opacity-100 hover:grayscale-0 transition-all duration-500">
                    <div className="flex items-center gap-2">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                        <span className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-400">Verificação de Integridade Digital Ativa</span>
                    </div>
                    <span className="text-[8px] font-mono font-bold text-slate-400 tracking-tighter uppercase font-mono">ID-{order.id.slice(-8).toUpperCase()}</span>
                </div>
            </div>
        </div>
    );

    // Helper to render Items Tab Content
    const renderItems = () => {
        const canViewFullDetails = ['admin', 'compras', 'licitacao'].includes(currentUser?.role as string) || !!currentUser?.permissions?.includes('parent_compras') || !!currentUser?.permissions?.includes('parent_licitacao');

        return (
        <div className="p-8 w-full animate-fade-in">
            <div className="max-w-5xl mx-auto space-y-4">
                <div className="flex items-center justify-between mb-4 px-4">
                    <h3 className="font-black text-slate-800 uppercase tracking-wider text-xs flex items-center gap-2">
                        <PackageCheck className="w-4 h-4 text-emerald-500" />
                        Relatório Técnico de Itens solicitados
                    </h3>
                    <div className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-black uppercase tracking-widest">
                        Total: {content?.purchaseItems?.length || 0} Itens
                    </div>
                </div>

                <div className="bg-white rounded-[2rem] border border-slate-200 shadow-xl shadow-slate-200/50 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200">
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 w-16">#</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Item / Descrição</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Marca/Modelo</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Quantidade</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Ação</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {content?.purchaseItems?.map((item, idx) => (
                                    <tr key={idx} className={`group transition-all ${item.isTendered === false
                                        ? 'bg-rose-50/50 border-l-4 border-l-rose-500'
                                        : 'hover:bg-slate-50/50 border-l-4 border-l-transparent'}`}>
                                        <td className="px-6 py-5">
                                            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center font-bold text-slate-500 text-xs shadow-sm">
                                                {idx + 1}
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex flex-col gap-1">
                                                <span className="font-bold text-slate-800 text-sm group-hover:text-indigo-600 transition-colors">{item.name}</span>
                                                {canViewFullDetails && item.code && (
                                                    <span className="w-fit px-2 py-0.5 bg-indigo-50 border border-indigo-100 rounded text-[9px] font-black text-indigo-600 uppercase tracking-tight shadow-sm">
                                                        Cód: {item.code}
                                                    </span>
                                                )}
                                                {item.details && <span className="text-xs text-slate-400 font-medium">{item.details}</span>}
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <span className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-black text-slate-600 uppercase tracking-tight">
                                                {item.brand || 'Original'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5 text-center">
                                            <div className="inline-flex items-center px-3 py-1 bg-indigo-50 text-indigo-700 font-mono font-bold rounded-lg border border-indigo-100 text-xs">
                                                {item.quantity} <span className="text-[10px] opacity-60 ml-1">{item.unit}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 text-right">
                                            {item.isTendered === false ? (
                                                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-500 text-white rounded-full shadow-lg shadow-rose-500/20 text-[9px] font-black uppercase tracking-widest animate-pulse">
                                                    Não Licitado
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => handleMarkAsUntendered(idx)}
                                                    className="p-2 text-slate-300 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"
                                                    title="Marcar como não licitado"
                                                >
                                                    <AlertTriangle className="w-4 h-4" />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
        );
    };

    // Helper to render Justification Tab Content
    const renderJustification = () => (
        <div className="p-8 w-full animate-fade-in">
            <div className="max-w-4xl mx-auto">
                <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl shadow-slate-200/40 p-12 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-12 opacity-5 scale-150 rotate-12 pointer-events-none">
                        <MessageCircle className="w-64 h-64" />
                    </div>

                    <div className="relative z-10">
                        <div className="flex items-center gap-4 mb-10 border-b border-slate-100 pb-8">
                            <div className="w-16 h-16 bg-slate-900 rounded-[1.5rem] flex items-center justify-center text-white shadow-xl shadow-slate-900/20">
                                <FileText className="w-8 h-8" />
                            </div>
                            <div>
                                <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Justificativa Técnica</h3>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">Finalidade e Motivação do Processo</p>
                            </div>
                        </div>

                        <div className="prose prose-slate max-w-none">
                            <div className="bg-slate-50/50 p-8 rounded-3xl border border-slate-100 text-slate-700 text-lg leading-relaxed font-medium whitespace-pre-wrap shadow-inner italic">
                                "{content?.body || 'Nenhuma justificativa textual detalhada foi inserida para este pedido.'}"
                            </div>
                        </div>

                        {content?.priorityJustification && (
                            <div className="mt-10 p-8 bg-rose-50/70 border-2 border-dashed border-rose-200 rounded-3xl">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 bg-rose-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-rose-600/20">
                                        <AlertTriangle className="w-6 h-6" />
                                    </div>
                                    <h4 className="text-lg font-black text-rose-900 uppercase tracking-tight">Motivação de Prioridade ({content.priority})</h4>
                                </div>
                                <p className="text-rose-800 font-bold leading-relaxed ml-2">{content.priorityJustification}</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );

    const renderCategoryModal = () => (
        isCategoryModalOpen && createPortal(
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in">
                <div className="bg-white rounded-[2rem] w-full max-w-md p-8 shadow-2xl relative animate-scale-up border border-white/20">
                    <button
                        onClick={() => setIsCategoryModalOpen(false)}
                        className="absolute top-6 right-6 p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-800"
                    >
                        <XCircle className="w-6 h-6" />
                    </button>

                    <div className="text-center mb-6">
                        <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-500 mx-auto mb-4 shadow-sm">
                            <PackageCheck className="w-8 h-8" />
                        </div>
                        <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight mb-1">Marcar Não Licitado</h3>
                        <p className="text-sm text-slate-500 font-medium">Selecione a categoria para este item</p>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Categoria</label>
                            <select
                                value={selectedCategory}
                                onChange={(e) => setSelectedCategory(e.target.value as InventoryCategory)}
                                className="w-full h-12 px-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 font-bold focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all appearance-none"
                            >
                                <option value="">Selecione...</option>
                                <option value="Construção">Construção</option>
                                <option value="Limpeza">Limpeza</option>
                                <option value="Alimentação">Alimentação</option>
                                <option value="Material de Uso">Material de Uso</option>
                                <option value="Ferramentas">Ferramentas</option>
                                <option value="Serviços">Serviços</option>
                            </select>
                        </div>

                        <button
                            onClick={confirmUntendered}
                            disabled={!selectedCategory || isProcessing}
                            className={`w-full py-3.5 rounded-xl font-black uppercase tracking-widest text-xs shadow-lg transition-all flex items-center justify-center gap-2 ${!selectedCategory || isProcessing
                                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                : 'bg-rose-500 text-white hover:bg-rose-600 shadow-rose-500/20 active:scale-95'
                                }`}
                        >
                            {isProcessing ? (
                                <><Clock className="w-4 h-4 animate-spin" /> Processando...</>
                            ) : (
                                <><CheckCircle2 className="w-4 h-4" /> Confirmar</>
                            )}
                        </button>
                    </div>
                </div>
            </div>,
            document.body
        )
    );

    const renderAccountModal = () => {
        const filteredAccounts = accounts.filter(acc =>
            acc.account_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
            acc.description.toLowerCase().includes(searchTerm.toLowerCase())
        );

        return (
            isAccountModalOpen && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-[2rem] w-full max-w-lg shadow-2xl relative animate-scale-up border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
                        {/* Header */}
                        <div className="p-8 border-b border-slate-100 shrink-0">
                            <button
                                onClick={() => setIsAccountModalOpen(false)}
                                className="absolute top-8 right-8 p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400"
                            >
                                <XCircle className="w-6 h-6" />
                            </button>
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
                                    <Landmark className="w-8 h-8" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Dotação Orçamentária</h3>
                                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Vincule uma conta para prosseguir</p>
                                </div>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                            {!isCreatingAccount ? (
                                <div className="space-y-6">
                                    {/* Search & Actions */}
                                    <div className="flex items-center gap-3">
                                        <div className="relative flex-1">
                                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                            <input
                                                type="text"
                                                placeholder="Buscar por número ou descrição..."
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                                className="w-full h-12 pl-12 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-none transition-all font-medium"
                                            />
                                        </div>
                                        <button
                                            onClick={() => setIsCreatingAccount(true)}
                                            className="h-12 px-4 bg-indigo-600 text-white rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 active:scale-95"
                                        >
                                            <Plus className="w-5 h-5" />
                                            <span className="hidden sm:inline">Nova</span>
                                        </button>
                                    </div>

                                    {/* List */}
                                    <div className="space-y-2">
                                        {filteredAccounts.length > 0 ? (
                                            filteredAccounts.map(acc => (
                                                <button
                                                    key={acc.id}
                                                    onClick={() => handleSelectAccount(acc)}
                                                    className="w-full p-4 text-left bg-white border border-slate-100 rounded-2xl hover:border-indigo-300 hover:shadow-md transition-all flex items-center justify-between group"
                                                >
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                                                            <Briefcase className="w-5 h-5" />
                                                        </div>
                                                        <div>
                                                            <div className="text-sm font-black text-slate-800">{acc.account_number}</div>
                                                            <div className="text-[10px] text-slate-500 font-medium uppercase truncate max-w-[200px] sm:max-w-xs">{acc.description}</div>
                                                        </div>
                                                    </div>
                                                    <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-600 transition-colors" />
                                                </button>
                                            ))
                                        ) : (
                                            <div className="py-12 text-center text-slate-400">
                                                <Search className="w-12 h-12 mx-auto mb-4 opacity-20" />
                                                <p className="font-bold">Nenhuma conta encontrada</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-5 animate-slide-in-right">
                                    <h4 className="font-black text-slate-800 uppercase tracking-widest text-xs mb-2">Cadastrar Nova Conta</h4>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Número da Dotação</label>
                                            <input
                                                type="text"
                                                placeholder="Ex: 01.02.03.04"
                                                value={newAccountData.account_number}
                                                onChange={(e) => setNewAccountData({ ...newAccountData, account_number: e.target.value })}
                                                className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-none transition-all font-mono font-bold"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Descrição / Finalidade</label>
                                            <textarea
                                                placeholder="Descreva a finalidade desta dotação..."
                                                value={newAccountData.description}
                                                onChange={(e) => setNewAccountData({ ...newAccountData, description: e.target.value })}
                                                className="w-full h-24 p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-none transition-all font-medium resize-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Secretaria / Setor</label>
                                            <input
                                                type="text"
                                                placeholder="Ex: Secretaria de Saúde"
                                                value={newAccountData.sector}
                                                onChange={(e) => setNewAccountData({ ...newAccountData, sector: e.target.value })}
                                                className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-none transition-all font-medium"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex gap-3 pt-6">
                                        <button
                                            onClick={() => setIsCreatingAccount(false)}
                                            className="flex-1 h-12 border border-slate-200 text-slate-500 rounded-xl font-bold hover:bg-slate-50 transition-all uppercase text-[10px] tracking-widest"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            onClick={handleCreateAccount}
                                            disabled={isProcessing}
                                            className="flex-1 h-12 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 uppercase text-[10px] tracking-widest active:scale-95 disabled:opacity-50"
                                        >
                                            {isProcessing ? 'Processando...' : 'Salvar e Vincular'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>,
                document.body
            )
        );
    };

    return (
        <div className="flex-1 flex flex-col bg-slate-50 overflow-hidden h-full animate-fade-in">
            {/* Header / Nav */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm shrink-0">
                <div className="w-full px-6 py-2">
                    <div className="flex items-center justify-between gap-4">
                        {/* Left: Voltar */}
                        <div className="flex-1 flex justify-start">
                            <button
                                onClick={onBack}
                                className="flex items-center gap-2 text-slate-400 hover:text-indigo-600 transition-all font-bold uppercase tracking-widest group text-[10px] hover:bg-slate-50 p-2 rounded-xl"
                                title="Voltar"
                            >
                                <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" />
                                <span className="hidden lg:inline">Voltar</span>
                            </button>
                        </div>

                        {/* Center: Tabs */}
                        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar scroll-smooth py-1">
                            {[
                                { id: 'overview', label: 'Visão Geral', icon: FileText },
                                { id: 'items', label: 'Itens', icon: ShoppingCart },
                                { id: 'justification', label: 'Justificativa', icon: MessageCircle },
                                { id: 'history', label: 'Histórico', icon: History, count: order.statusHistory?.length },
                                { id: 'conta', label: 'Conta', icon: Landmark },
                                { id: 'attachments', label: 'Anexos', icon: Paperclip, count: order.attachments?.length },
                                { id: 'signature', label: 'Assinatura', icon: FileSignature }
                            ].map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as TabType)}
                                    className={`px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center gap-2.5 shrink-0 active:scale-95 ${activeTab === tab.id
                                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                                        : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'
                                        }`}
                                >
                                    <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? 'text-white' : 'text-slate-300'}`} />
                                    <span className="hidden sm:inline">{tab.label}</span>
                                    {tab.count !== undefined && tab.count > 0 && (
                                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-mono font-black border ${activeTab === tab.id ? 'bg-white/20 border-white/20 text-white' : 'bg-slate-100 border-slate-200 text-slate-500'
                                            }`}>
                                            {tab.count}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>

                        {/* Right: PDF Button */}
                        <div className="flex-1 flex justify-end">
                            {order.documentSnapshot && (
                                <button
                                    onClick={() => onDownloadPdf(order.documentSnapshot!, 'compras')}
                                    className="px-3 py-1.5 bg-white text-indigo-600 border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50 rounded-lg font-bold text-[10px] uppercase tracking-wide flex items-center gap-1.5 transition-all active:scale-95 shadow-sm"
                                >
                                    <Download className="w-3 h-3" /> <span className="hidden lg:inline">PDF</span>
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className={`flex-1 ${activeTab === 'conta' ? 'overflow-hidden' : 'overflow-y-auto'} custom-scrollbar bg-slate-50/30`}>
                <div className="h-full w-full">
                    {activeTab === 'overview' && renderOverview()}
                    {activeTab === 'items' && renderItems()}
                    {activeTab === 'justification' && renderJustification()}
                    {activeTab === 'history' && renderHistory()}
                    {activeTab === 'attachments' && renderAttachments()}
                    {activeTab === 'signature' && renderSignature()}
                    {activeTab === 'conta' && renderConta()}
                </div>
            </div>
            {renderCategoryModal()}
            {renderAccountModal()}
        </div>
    );
};
