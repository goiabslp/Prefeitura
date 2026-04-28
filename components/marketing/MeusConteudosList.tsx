import React, { useEffect, useState } from 'react';
import { supabase } from '../../services/supabaseClient';
import { FileText, Clock, CheckCircle2, AlertCircle, Loader2, Trash2, ArrowLeft, Search, RefreshCw, Hash as HashIcon, User as UserIcon, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MarketingAlertModal, MarketingAlertModalProps } from './MarketingAlertModal';

interface MeusConteudosListProps {
    userId: string;
    userRole?: string;
    onOpenDetails: (id: string) => void;
    onLoaded?: (firstId: string) => void;
    lastRefresh?: number;
    onBack?: () => void;
}

export const MeusConteudosList: React.FC<MeusConteudosListProps> = ({ userId, userRole, onOpenDetails, onLoaded, lastRefresh, onBack }) => {
    const isAdmin = userRole?.toLowerCase() === 'admin' || userRole?.toLowerCase() === 'marketing' || userRole === 'Administrador' || userRole === 'Marketing';
    const [requests, setRequests] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Custom Alert State
    const [alertConfig, setAlertConfig] = useState<MarketingAlertModalProps>({
        isOpen: false,
        type: 'info',
        title: '',
        message: '',
        onClose: () => setAlertConfig(prev => ({ ...prev, isOpen: false }))
    });

    const showAlert = (type: MarketingAlertModalProps['type'], title: string, message: string, onConfirm?: () => void, showCancel?: boolean, confirmText?: string, cancelText?: string) => {
        setAlertConfig({
            isOpen: true,
            type,
            title,
            message,
            onConfirm,
            showCancel,
            confirmText: confirmText || 'OK',
            cancelText: cancelText || 'Cancelar',
            onClose: () => setAlertConfig(prev => ({ ...prev, isOpen: false }))
        });
    };

    const fetchRequests = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('marketing_requests')
                .select(`
                    id,
                    protocol,
                    description,
                    status,
                    created_at,
                    requester_name,
                    delivery_date,
                    responsible:profiles!marketing_requests_responsible_id_fkey ( name ),
                    marketing_contents ( content_type )
                `);

            if (!isAdmin) {
                query = query.eq('user_id', userId);
            }

            const { data, error } = await query
                .order('created_at', { ascending: false })
                .order('protocol', { ascending: false });

            if (error) throw error;
            const fetchedRequests = data || [];
            setRequests(fetchedRequests);
            if (fetchedRequests.length > 0 && onLoaded) {
                onLoaded(fetchedRequests[0].id);
            }
        } catch (err) {
            console.error("Erro ao buscar requests de marketing:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (userId) {
            fetchRequests();
        }
    }, [userId, lastRefresh]);

    const handleQuickStatusUpdate = async (e: React.MouseEvent, reqId: string, currentStatus: string) => {
        e.stopPropagation();
        if (!isAdmin || currentStatus === 'Revisando' || currentStatus === 'Concluído') return;

        try {
            const { error } = await supabase
                .from('marketing_requests')
                .update({ status: 'Revisando' })
                .eq('id', reqId);

            if (error) throw error;

            // Optimistic Update
            setRequests(prev => prev.map(req => 
                req.id === reqId ? { ...req, status: 'Revisando' } : req
            ));

            showAlert('success', 'Status Atualizado', 'A solicitação agora está em revisão.');
        } catch (err) {
            console.error("Erro ao atualizar status rápido:", err);
            showAlert('error', 'Erro', 'Não foi possível atualizar o status.');
        }
    };

    const handleDeleteClick = (e: React.MouseEvent, reqId: string, title?: string) => {
        e.stopPropagation();
        showAlert(
            'warning',
            'Excluir Solicitação',
            `Tem certeza que deseja excluir a solicitação "${title || 'Sem Título'}"? Esta ação não pode ser desfeita.`,
            async () => {
                try {
                    setAlertConfig(prev => ({ ...prev, isOpen: false }));
                    const { error } = await supabase.from('marketing_requests').delete().eq('id', reqId);
                    if (error) throw error;

                    setRequests(requests.filter(req => req.id !== reqId));
                    setTimeout(() => {
                        showAlert('success', 'Excluído', 'A solicitação foi excluída com sucesso.');
                    }, 300);
                } catch (err) {
                    console.error("Erro deletar pedido:", err);
                    showAlert('error', 'Erro', 'Não foi possível excluir a solicitação. Tente novamente mais tarde.');
                }
            },
            true,
            'Sim, Excluir',
            'Cancelar'
        );
    };

    const getStatusConfig = (status: string) => {
        switch (status) {
            case 'Em Análise': return { color: 'amber', icon: Clock, bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' };
            case 'Na Fila': return { color: 'orange', icon: Clock, bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' };
            case 'Revisando': return { color: 'blue', icon: AlertCircle, bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' };
            case 'Produzindo': return { color: 'indigo', icon: Loader2, bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' };
            case 'Aprovado': return { color: 'emerald', icon: CheckCircle2, bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' };
            case 'Concluído': return { color: 'emerald', icon: CheckCircle2, bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' };
            case 'Rejeitado': return { color: 'rose', icon: AlertCircle, bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' };
            default: return { color: 'slate', icon: FileText, bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200' };
        }
    };

    const extractTitle = (desc?: string) => {
        if (!desc) return 'Sem Título';
        const match = desc.match(/\*\*Título do Pedido:\*\* (.*?)\n/);
        return match && match[1] ? match[1] : 'Sem Título';
    };

    const filteredRequests = requests.filter(req => {
        const term = searchTerm.toLowerCase();
        const title = extractTitle(req.description).toLowerCase();
        return title.includes(term) ||
               (req.protocol && req.protocol.toLowerCase().includes(term)) ||
               (req.requester_name && req.requester_name.toLowerCase().includes(term));
    });

    return (
        <div className="flex-1 h-full w-full bg-slate-100/50 backdrop-blur-sm font-sans flex items-center justify-center p-4 desktop:p-8 overflow-hidden animate-fade-in">
            <div className="w-full max-w-7xl bg-white rounded-[2.5rem] shadow-[0_25px_70px_-15px_rgba(0,0,0,0.15)] border border-slate-200 overflow-hidden animate-slide-up flex flex-col h-full max-h-full">
                
                {/* Header */}
                <div className="p-4 border-b border-slate-100 shrink-0 bg-white transition-all">
                    <div className="flex flex-col desktop:flex-row desktop:items-center justify-between gap-4">
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                            <div className="contents">
                                <button
                                    onClick={onBack}
                                    className="flex items-center gap-2 text-slate-400 hover:text-indigo-600 transition-colors font-bold uppercase tracking-widest group text-[10px] p-2 hover:bg-slate-50 rounded-lg -ml-2"
                                    title="Voltar"
                                >
                                    <ArrowLeft className="transition-transform w-3 h-3" />
                                </button>
                                <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3 shrink-0">
                                    <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/30">
                                        <FileText className="w-4 h-4 text-white" />
                                    </div>
                                    <span className="truncate uppercase">{isAdmin ? 'Gestão de Conteúdos' : 'Meus Conteúdos'}</span>
                                </h2>
                            </div>
                        </div>

                        <div className="flex-1 max-w-lg flex items-center gap-2">
                            <div className="relative flex-1 group">
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="Buscar por título, protocolo ou solicitante..."
                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 font-medium focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all pl-9 pr-3 py-2 text-xs"
                                />
                                <Search className="absolute top-1/2 -translate-y-1/2 text-slate-400 left-3 w-3.5 h-3.5" />
                            </div>
                            <button
                                onClick={fetchRequests}
                                disabled={loading}
                                className="flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-slate-600 hover:text-indigo-600 hover:border-indigo-200 transition-all font-bold text-[10px] uppercase tracking-widest whitespace-nowrap active:scale-95 shadow-sm disabled:opacity-50"
                            >
                                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                                Atualizar
                            </button>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto custom-scrollbar bg-white">
                    {loading ? (
                        <div className="h-full flex flex-col items-center justify-center space-y-4">
                            <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
                            <p className="text-slate-400 font-medium text-sm animate-pulse">Carregando solicitações...</p>
                        </div>
                    ) : filteredRequests.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center p-8 h-full">
                            <div className="bg-slate-50 rounded-[2rem] border border-slate-100 p-12 text-center flex flex-col items-center justify-center w-full max-w-2xl mx-auto shadow-sm">
                                <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm border border-slate-100">
                                    <FileText className="w-8 h-8 text-slate-300" />
                                </div>
                                <h3 className="text-lg font-black text-slate-900 mb-2 tracking-tight">
                                    {searchTerm ? 'Nenhum resultado encontrado' : 'Nenhuma solicitação encontrada'}
                                </h3>
                                <p className="text-sm text-slate-500 font-medium">
                                    {searchTerm 
                                        ? 'Tente ajustar os termos da sua pesquisa.' 
                                        : 'Ainda não há solicitações cadastradas nesta visualização.'}
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="min-w-full">
                            {/* Table Header */}
                            <div className="border-b border-slate-100 bg-slate-50 hidden desktop:grid desktop:grid-cols-12 gap-4 px-8 py-4 sticky top-0 z-10">
                                <div className="md:col-span-1 text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-center gap-2 whitespace-nowrap">
                                    <Calendar className="w-3 h-3" /> Data
                                </div>
                                <div className="md:col-span-1 text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-center gap-2 whitespace-nowrap">
                                    <HashIcon className="w-3 h-3" /> Protocolo
                                </div>
                                <div className="md:col-span-4 text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 whitespace-nowrap">
                                    <FileText className="w-3 h-3" /> Título / Solicitante
                                </div>
                                <div className="md:col-span-2 text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-center gap-2 whitespace-nowrap">
                                    <UserIcon className="w-3 h-3" /> Responsável / Previsão
                                </div>
                                <div className="md:col-span-2 text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-center gap-2 whitespace-nowrap">
                                    Status
                                </div>
                                <div className="md:col-span-2 text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-center gap-2 whitespace-nowrap">
                                    Ações
                                </div>
                            </div>

                            {/* Table Body */}
                            <div className="divide-y divide-slate-100">
                                {filteredRequests.map(req => {
                                    const createdDate = new Date(req.created_at);
                                    const monthName = createdDate.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase();
                                    const yearLabel = createdDate.toLocaleDateString('pt-BR', { year: '2-digit' });
                                    
                                    const statusConfig = getStatusConfig(req.status);
                                    const StatusIcon = statusConfig.icon;
                                    const respName = (isAdmin || req.responsible?.name?.toUpperCase() !== 'TESTE') ? req.responsible?.name || 'Aguardando' : 'Privado';

                                    return (
                                        <div 
                                            key={req.id} 
                                            onClick={() => onOpenDetails(req.id)}
                                            className="grid grid-cols-1 desktop:grid-cols-12 gap-4 px-8 py-5 hover:bg-slate-50/80 transition-colors items-center cursor-pointer group"
                                        >
                                            {/* Data */}
                                            <div className="md:col-span-1 flex justify-center">
                                                <div className="w-11 h-11 bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center shadow-sm shrink-0">
                                                    <span className="text-[7px] font-black text-slate-400 uppercase">
                                                        {monthName}/{yearLabel}
                                                    </span>
                                                    <span className="text-base font-black text-emerald-600 leading-none">
                                                        {createdDate.getDate()}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Protocolo */}
                                            <div className="md:col-span-1 flex justify-center">
                                                <span className="font-mono text-[10px] font-bold text-indigo-600 bg-indigo-50/50 px-2 py-1 rounded border border-indigo-100/50">
                                                    {req.protocol}
                                                </span>
                                            </div>

                                            {/* Título e Solicitante */}
                                            <div className="md:col-span-4">
                                                <h3 className="text-sm font-bold text-slate-800 leading-tight line-clamp-1" title={extractTitle(req.description)}>
                                                    {extractTitle(req.description)}
                                                </h3>
                                                <p className="text-[10px] text-slate-400 font-medium mt-1 flex items-center gap-1 line-clamp-1">
                                                    <UserIcon className="w-3 h-3" /> Solicitante: {req.requester_name || '-'}
                                                </p>
                                            </div>

                                            {/* Responsável e Previsão */}
                                            <div className="md:col-span-2 flex flex-col items-center justify-center gap-1">
                                                <span className="text-[10px] font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded-md border border-slate-200 truncate max-w-full" title={respName}>
                                                    {respName}
                                                </span>
                                                {req.delivery_date ? (
                                                    <span className="text-[9px] font-black text-indigo-600">
                                                        Prev: {format(new Date(req.delivery_date), "dd/MM/yyyy", { locale: ptBR })}
                                                    </span>
                                                ) : (
                                                    <span className="text-[9px] font-medium text-slate-400">Sem previsão</span>
                                                )}
                                            </div>

                                            {/* Status */}
                                            <div className="md:col-span-2 flex justify-center">
                                                <button 
                                                    onClick={(e) => handleQuickStatusUpdate(e, req.id, req.status)}
                                                    disabled={!isAdmin || req.status === 'Revisando' || req.status === 'Concluído'}
                                                    className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full border ${statusConfig.bg} ${statusConfig.text} ${statusConfig.border} shadow-sm transition-all ${isAdmin && req.status !== 'Revisando' && req.status !== 'Concluído' ? 'hover:brightness-95 active:scale-95' : 'cursor-default'}`}
                                                >
                                                    <StatusIcon className={`w-3.5 h-3.5 ${req.status === 'Produzindo' ? 'animate-spin' : ''}`} />
                                                    <span className="text-[9px] font-black uppercase tracking-widest">
                                                        {req.status}
                                                    </span>
                                                </button>
                                            </div>

                                            {/* Ações */}
                                            <div className="md:col-span-2 flex items-center justify-center gap-2 opacity-50 group-hover:opacity-100 transition-opacity">
                                                <button 
                                                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all" 
                                                    title="Ver Detalhes"
                                                    onClick={(e) => { e.stopPropagation(); onOpenDetails(req.id); }}
                                                >
                                                    <FileText className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={(e) => handleDeleteClick(e, req.id, extractTitle(req.description))}
                                                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                                    title="Excluir Solicitação"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal Interativo Customizado */}
            <MarketingAlertModal {...alertConfig} />
        </div>
    );
};
