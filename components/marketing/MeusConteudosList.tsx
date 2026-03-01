import React, { useEffect, useState } from 'react';
import { supabase } from '../../services/supabaseClient';
import { FileText, Clock, CheckCircle2, AlertCircle, Loader2, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MarketingAlertModal, MarketingAlertModalProps } from './MarketingAlertModal';

interface MeusConteudosListProps {
    userId: string;
    onOpenDetails: (id: string) => void;
}

export const MeusConteudosList: React.FC<MeusConteudosListProps> = ({ userId, onOpenDetails }) => {
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
                const { data, error } = await supabase
                    .from('marketing_requests')
                    .select(`
                        id,
                        protocol,
                        title,
                        status,
                        created_at,
                        marketing_contents ( content_type )
                    `)
                    .eq('user_id', userId)
                    .order('created_at', { ascending: false });

                if (error) throw error;
                setRequests(data || []);
            } catch (err) {
                console.error("Erro ao buscar requests de marketing:", err);
            } finally {
                setLoading(false);
            }
        };

        if (userId) {
            fetchRequests();
        }
    }, [userId]);

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
            case 'Aprovado': return { color: 'emerald', icon: CheckCircle2 };
            case 'Rejeitado': return { color: 'rose', icon: AlertCircle };
            default: return { color: 'slate', icon: FileText };
        }
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
        <div className="absolute inset-0 overflow-auto custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[600px]">
                <thead className="sticky top-0 z-10 bg-slate-50/90 backdrop-blur-sm">
                    <tr className="border-b border-slate-100 uppercase text-[10px] tracking-wider text-slate-400 font-bold">
                        <th className="py-3 px-4 md:py-4 md:px-6 whitespace-nowrap">Título do Conteúdo</th>
                        <th className="py-3 px-4 md:py-4 md:px-6 whitespace-nowrap">Data de criação</th>
                        <th className="py-3 px-4 md:py-4 md:px-6 whitespace-nowrap text-center">STATUS</th>
                        <th className="py-3 px-4 md:py-4 md:px-6 whitespace-nowrap text-right">Ação</th>
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
                                <td className="py-3 px-4 md:py-4 md:px-6">
                                    <div className="font-bold text-slate-800 text-sm md:text-base mb-0.5 max-w-[200px] md:max-w-[300px] truncate" title={req.title || 'Sem Título'}>
                                        {req.title || 'Sem Título'}
                                    </div>
                                    <div className="text-[10px] text-slate-400 font-mono tracking-wide">{req.protocol}</div>
                                </td>
                                <td className="py-3 px-4 md:py-4 md:px-6">
                                    <div className="text-xs md:text-sm text-slate-500 font-medium">
                                        {format(new Date(req.created_at), "dd/MM/yyyy", { locale: ptBR })}
                                    </div>
                                    <div className="text-[10px] text-slate-400">
                                        {format(new Date(req.created_at), "HH:mm")}
                                    </div>
                                </td>
                                <td className="py-3 px-4 md:py-4 md:px-6 text-center">
                                    <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-${statusConfig.color}-50 text-${statusConfig.color}-700 border border-${statusConfig.color}-200 shadow-sm mx-auto`}>
                                        <StatusIcon className={`w-3.5 h-3.5 md:w-4 md:h-4 text-${statusConfig.color}-500`} />
                                        <span className="text-[10px] md:text-xs font-black tracking-widest uppercase">{req.status}</span>
                                    </div>
                                </td>
                                <td className="py-3 px-4 md:py-4 md:px-6 text-right">
                                    <button
                                        onClick={(e) => handleDeleteClick(e, req.id, req.title)}
                                        className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-white border border-slate-200 text-slate-400 flex items-center justify-center hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-all shadow-sm ml-auto opacity-0 group-hover:opacity-100"
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
