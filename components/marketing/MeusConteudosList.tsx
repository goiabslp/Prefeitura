import React, { useEffect, useState } from 'react';
import { supabase } from '../../services/supabaseClient';
import { FileText, Clock, CheckCircle2, AlertCircle, Loader2, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MarketingAlertModal, MarketingAlertModalProps } from './MarketingAlertModal';

interface MeusConteudosListProps {
    userId: string;
    userRole?: string;
    onOpenDetails: (id: string) => void;
    onLoaded?: (firstId: string) => void;
    lastRefresh?: number;
}

export const MeusConteudosList: React.FC<MeusConteudosListProps> = ({ userId, userRole, onOpenDetails, onLoaded, lastRefresh }) => {
    const isAdmin = userRole?.toLowerCase() === 'admin' || userRole?.toLowerCase() === 'marketing' || userRole === 'Administrador' || userRole === 'Marketing';
    const [requests, setRequests] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

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

    useEffect(() => {
        const fetchRequests = async () => {
            try {
                // Fetch requests and their contents
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
        e.stopPropagation(); // Prevents row from opening details
        showAlert(
            'warning',
            'Excluir Solicitação',
            `Tem certeza que deseja excluir a solicitação "${title || 'Sem Título'}"? Esta ação não pode ser desfeita.`,
            async () => {
                try {
                    setAlertConfig(prev => ({ ...prev, isOpen: false }));
                    const { error } = await supabase.from('marketing_requests').delete().eq('id', reqId);
                    if (error) throw error;

                    // Optimistic update
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
            case 'Em Análise': return { color: 'amber', icon: Clock };
            case 'Na Fila': return { color: 'orange', icon: Clock };
            case 'Revisando': return { color: 'blue', icon: AlertCircle };
            case 'Produzindo': return { color: 'indigo', icon: Loader2 };
            case 'Aprovado': return { color: 'emerald', icon: CheckCircle2 };
            case 'Concluído': return { color: 'emerald', icon: CheckCircle2 };
            case 'Rejeitado': return { color: 'rose', icon: AlertCircle };
            default: return { color: 'slate', icon: FileText };
        }
    };

    const extractTitle = (desc?: string) => {
        if (!desc) return 'Sem Título';
        const match = desc.match(/\*\*Título do Pedido:\*\* (.*?)\n/);
        return match && match[1] ? match[1] : 'Sem Título';
    };

    if (loading) {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center py-12 text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin mb-4 text-indigo-500" />
                <p className="text-sm font-semibold tracking-wide">Carregando solicitações...</p>
            </div>
        );
    }

    if (requests.length === 0) {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center py-12 text-slate-400">
                <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-4">
                    <FileText className="w-8 h-8 text-slate-300" />
                </div>
                <p className="text-base font-medium text-slate-500">Nenhuma solicitação encontrada.</p>
                <p className="text-xs mt-1">Clique em "Novo Conteúdo" para começar.</p>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-auto custom-scrollbar bg-white">
            <table className="w-full text-left border-collapse min-w-full">
                <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur-md shadow-sm">
                    <tr className="border-b border-slate-100 uppercase text-[10px] tracking-widest text-slate-400 font-black">
                        <th className="py-4 px-3 md:px-4 whitespace-nowrap">Título do Conteúdo</th>
                        <th className="py-4 px-3 md:px-4 whitespace-nowrap">Solicitante</th>
                        <th className="py-4 px-3 md:px-4 whitespace-nowrap text-center">Responsável</th>
                        <th className="py-4 px-3 md:px-4 whitespace-nowrap">Data de criação</th>
                        <th id="tour-status-col" className="py-4 px-3 md:px-4 whitespace-nowrap text-center">STATUS</th>
                        <th id="tour-forecast-col" className="py-4 px-3 md:px-4 whitespace-nowrap text-center">Previsão</th>
                        <th className="py-4 px-3 md:px-4 whitespace-nowrap text-center min-w-[100px]">Ações</th>
                    </tr>
                </thead>
                <tbody>
                    {requests.map((req) => {
                        const statusConfig = getStatusConfig(req.status);
                        const StatusIcon = statusConfig.icon;
                        const types = req.marketing_contents?.map((c: any) => c.content_type).join(', ') || 'Nenhum';

                        return (
                            <tr
                                key={req.id}
                                onClick={() => onOpenDetails(req.id)}
                                className="group border-b border-slate-50 hover:bg-slate-50/80 cursor-pointer transition-colors"
                            >
                                <td className="py-4 px-3 md:px-4">
                                    <div className="font-bold text-slate-800 text-sm md:text-base mb-0.5 max-w-[200px] md:max-w-[400px] truncate" title={extractTitle(req.description)}>
                                        {extractTitle(req.description)}
                                    </div>
                                    <div className="text-[10px] text-slate-400 font-mono tracking-widest">{req.protocol}</div>
                                </td>
                                <td className="py-4 px-3 md:px-4">
                                    <div className="text-xs font-bold text-slate-700 truncate max-w-[120px]" title={req.requester_name}>
                                        {req.requester_name || '-'}
                                    </div>
                                </td>
                                <td className="py-4 px-3 md:px-4 text-center min-w-[140px]">
                                    <div className="text-[10px] md:text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg inline-block whitespace-nowrap max-w-[150px] truncate" title={(userRole?.toLowerCase() === 'admin' || userRole === 'Administrador' || req.responsible?.name?.toUpperCase() !== 'TESTE') ? req.responsible?.name || 'Aguardando' : 'Privado'}>
                                        {(userRole?.toLowerCase() === 'admin' || userRole === 'Administrador' || req.responsible?.name?.toUpperCase() !== 'TESTE') ? req.responsible?.name || 'Aguardando' : 'Privado'}
                                    </div>
                                </td>
                                <td className="py-4 px-3 md:px-4">
                                    <div className="text-xs md:text-sm text-slate-500 font-medium">
                                        {format(new Date(req.created_at), "dd/MM/yyyy", { locale: ptBR })}
                                    </div>
                                    <div className="text-[10px] text-slate-400">
                                        {format(new Date(req.created_at), "HH:mm")}
                                    </div>
                                </td>
                                <td className="py-4 px-3 md:px-4 text-center">
                                    <button 
                                        onClick={(e) => handleQuickStatusUpdate(e, req.id, req.status)}
                                        disabled={!isAdmin || req.status === 'Revisando' || req.status === 'Concluído'}
                                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-${statusConfig.color}-50 text-${statusConfig.color}-700 border border-${statusConfig.color}-200 shadow-sm mx-auto transition-all ${isAdmin && req.status !== 'Revisando' && req.status !== 'Concluído' ? 'hover:bg-blue-100 hover:text-blue-800 hover:border-blue-300 active:scale-95' : 'cursor-default'}`}
                                    >
                                        <StatusIcon className={`w-3.5 h-3.5 md:w-4 md:h-4 text-${statusConfig.color}-500 ${req.status === 'Produzindo' ? 'animate-spin' : ''}`} />
                                        <span className="text-[10px] md:text-xs font-black tracking-widest uppercase">{req.status}</span>
                                    </button>
                                </td>
                                <td className="py-4 px-3 md:px-4 text-center text-xs font-bold text-slate-600">
                                    {req.delivery_date ? (
                                        <div className="flex flex-col items-center">
                                            <span className="text-indigo-600 tracking-tighter">
                                                {format(new Date(req.delivery_date), "dd/MM/yyyy", { locale: ptBR })}
                                            </span>
                                            <span className="text-[10px] text-slate-400 font-medium">Forecast</span>
                                        </div>
                                    ) : (
                                        <span className="text-slate-300">—</span>
                                    )}
                                </td>
                                <td className="py-4 px-3 md:px-4 text-center">
                                    <button
                                        onClick={(e) => handleDeleteClick(e, req.id, extractTitle(req.description))}
                                        className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-white border border-slate-200 text-slate-400 flex items-center justify-center hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-all shadow-sm mx-auto"
                                        title="Excluir Solicitação"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>

            {/* Modal Interativo Customizado */}
            <MarketingAlertModal {...alertConfig} />
        </div>
    );
};
