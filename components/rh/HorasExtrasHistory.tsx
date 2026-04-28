import React, { useState, useEffect } from 'react';
import { RhHorasExtras } from '../../types';
import { getRhHorasExtrasHistory, deleteRhHorasExtras } from '../../services/rhService';
import { FileDown, Calendar, Users, Signature, Search, Trash2, Edit2, ArrowLeft, History, RefreshCcw, User, FileText } from 'lucide-react';

interface HorasExtrasHistoryProps {
    onDownloadPdf: (record: RhHorasExtras) => void;
    onEdit: (record: RhHorasExtras) => void;
    highlightId?: string | null;
    userRole: string;
    currentUserSector: string;
    lastRefresh?: number;
    onBack?: () => void;
}

export const HorasExtrasHistory: React.FC<HorasExtrasHistoryProps> = ({
    onDownloadPdf,
    onEdit,
    highlightId,
    userRole,
    currentUserSector,
    lastRefresh,
    onBack
}) => {
    const [history, setHistory] = useState<RhHorasExtras[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isDeleting, setIsDeleting] = useState<string | null>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);

    useEffect(() => {
        loadHistory();
    }, [lastRefresh]);

    const loadHistory = async () => {
        setIsLoading(true);
        try {
            const { data } = await getRhHorasExtrasHistory(1, 100);
            setHistory(data);
        } catch (error) {
            console.error('Error loading Horas Extras history:', error);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    };

    const handleRefresh = () => {
        setIsRefreshing(true);
        loadHistory();
    };

    const handleDelete = async (id: string, month: string) => {
        if (!window.confirm(`Tem certeza que deseja excluir o relatório de "${month}"? Esta ação não pode ser desfeita.`)) {
            return;
        }

        setIsDeleting(id);
        try {
            await deleteRhHorasExtras(id);
            await loadHistory();
        } catch (error) {
            console.error('Falha ao excluir o registro:', error);
            alert('Não foi possível excluir o registro. Tente novamente mais tarde.');
        } finally {
            setIsDeleting(null);
        }
    };

    const filteredHistory = history.filter(item => {
        // First filter by sector if not admin
        if (userRole !== 'admin' && item.sector !== currentUserSector) {
            return false;
        }

        const searchPrefix = searchTerm.toLowerCase();
        return (
            item.month.toLowerCase().includes(searchPrefix) ||
            item.sector.toLowerCase().includes(searchPrefix) ||
            item.user_name.toLowerCase().includes(searchPrefix)
        );
    });

    const formatDate = (dateString?: string) => {
        if (!dateString) return 'Data não disponível';
        return new Intl.DateTimeFormat('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(new Date(dateString));
    };

    return (
        <div className="flex-1 w-full h-full bg-slate-100/50 backdrop-blur-sm font-sans flex items-center justify-center p-4 desktop:p-8 overflow-hidden animate-fade-in">
            <div className="w-full max-w-6xl bg-white rounded-[2.5rem] shadow-[0_25px_70px_-15px_rgba(0,0,0,0.15)] border border-slate-200 overflow-hidden animate-slide-up flex flex-col h-full max-h-[90vh]">
                
                {/* Header Padronizado */}
                <div className="p-4 border-b border-slate-100 shrink-0 bg-white transition-all">
                    <div className="flex flex-col desktop:flex-row desktop:items-center justify-between gap-4">
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                            <div className="contents">
                                {onBack && (
                                    <button
                                        onClick={onBack}
                                        className="flex items-center gap-2 text-slate-400 hover:text-indigo-600 transition-colors font-bold uppercase tracking-widest group text-[10px] p-2 hover:bg-slate-50 rounded-lg -ml-2"
                                        title="Voltar"
                                    >
                                        <ArrowLeft className="w-3 h-3 group-hover:-translate-x-1 transition-transform" />
                                    </button>
                                )}
                                <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3 shrink-0">
                                    <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/30">
                                        <History className="w-4 h-4 text-white" />
                                    </div>
                                    <span className="truncate">Histórico de Lançamentos</span>
                                </h2>
                            </div>
                        </div>

                        {/* Search & Actions */}
                        <div className="flex flex-col sm:flex-row items-center gap-3 desktop:w-auto w-full shrink-0">
                            <div className="relative w-full sm:w-64 group">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                                <input
                                    type="text"
                                    placeholder="Buscar lançamentos..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 bg-slate-50/50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all placeholder:text-slate-400 font-medium"
                                />
                            </div>

                            <button
                                onClick={handleRefresh}
                                disabled={isLoading || isRefreshing}
                                className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 hover:text-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-xs uppercase tracking-wider disabled:opacity-50"
                            >
                                <RefreshCcw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                                <span className="sm:hidden">Atualizar</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* List Content */}
                <div className="flex-1 overflow-y-auto p-2 desktop:p-4 bg-slate-50/50 custom-scrollbar">
                    {/* Header Columns (Desktop Only) */}
                    <div className="hidden desktop:grid grid-cols-12 gap-4 px-6 py-3 mb-2 sticky top-0 bg-slate-50/95 backdrop-blur-sm z-10 rounded-xl border border-slate-200/60 shadow-sm text-[10px] font-extrabold tracking-widest text-slate-400 uppercase">
                        <div className="col-span-2">Mês / Ano</div>
                        <div className="col-span-2">Data Emissão</div>
                        <div className="col-span-3">Setor</div>
                        <div className="col-span-3">Responsável / Colaboradores</div>
                        <div className="col-span-2 text-center">Ações</div>
                    </div>

                    <div className="space-y-2">
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center py-20 px-4">
                                <div className="relative mb-4">
                                    <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <History className="w-4 h-4 text-indigo-600" />
                                    </div>
                                </div>
                                <h3 className="text-lg font-bold text-slate-700">Carregando histórico...</h3>
                                <p className="text-slate-400 text-sm">Buscando informações do servidor.</p>
                            </div>
                        ) : filteredHistory.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
                                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                                    <FileText className="w-8 h-8 text-slate-400" />
                                </div>
                                <h3 className="text-lg font-bold text-slate-800">Nenhum lançamento encontrado</h3>
                                <p className="text-slate-500 text-sm mt-1 max-w-sm">
                                    {searchTerm ? `Nenhum resultado para "${searchTerm}"` : "Ainda não existem planilhas cadastradas."}
                                </p>
                            </div>
                        ) : (
                            filteredHistory.map((record) => {
                                const isHighlighted = record.id === highlightId;
                                const isRecordDeleting = isDeleting === record.id;
                                
                                // Parse month to visually display as Mês / Ano
                                const [mesStr, anoStr] = record.month.split('/');

                                return (
                                    <div
                                        key={record.id}
                                        className={`group relative bg-white border rounded-2xl p-4 desktop:p-0 desktop:px-6 desktop:py-4 flex flex-col desktop:grid desktop:grid-cols-12 gap-4 desktop:gap-4 items-start desktop:items-center transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5
                                            ${isHighlighted ? 'border-indigo-400 shadow-md ring-2 ring-indigo-50' : 'border-slate-200 hover:border-indigo-200'}
                                            ${isRecordDeleting ? 'opacity-50 pointer-events-none' : ''}
                                        `}
                                    >
                                        {/* Col 1-2: Date Box */}
                                        <div className="desktop:col-span-2 flex items-center gap-4 w-full">
                                            <div className="flex flex-col items-center justify-center bg-white border-2 border-slate-100 rounded-xl p-2 w-16 h-16 shrink-0 shadow-sm group-hover:border-indigo-100 group-hover:shadow-indigo-100 transition-all">
                                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{mesStr?.substring(0, 3)}</span>
                                                <span className="text-lg font-black text-slate-700 leading-none mt-0.5">{anoStr?.substring(2) || '24'}</span>
                                            </div>
                                            <div className="flex-1 desktop:hidden">
                                                <div className="flex flex-wrap items-center gap-2 mb-1">
                                                    <span className="bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-md text-xs font-bold font-mono tracking-wider">
                                                        #{record.id?.substring(0, 6)}
                                                    </span>
                                                </div>
                                                <p className="text-slate-800 font-bold text-sm line-clamp-1">{record.sector}</p>
                                            </div>
                                        </div>

                                        {/* Col 3-4: Protocol/Date */}
                                        <div className="desktop:col-span-2 hidden desktop:flex flex-col items-start gap-1">
                                            <span className="bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-md text-[10px] font-bold font-mono tracking-wider flex items-center gap-1 w-fit">
                                                <Calendar className="w-3 h-3" />
                                                #{record.id?.substring(0, 6)}
                                            </span>
                                            <span className="text-xs font-medium text-slate-500 whitespace-nowrap">
                                                {formatDate(record.created_at)}
                                            </span>
                                        </div>

                                        {/* Col 5-7: Sector */}
                                        <div className="desktop:col-span-3 w-full hidden desktop:flex flex-col items-start justify-center pr-4">
                                            <div className="text-sm font-bold text-slate-800 line-clamp-2 leading-tight group-hover:text-indigo-700 transition-colors">
                                                {record.sector}
                                            </div>
                                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1 flex items-center gap-1">
                                                Setor Solicitante
                                            </div>
                                        </div>

                                        {/* Col 8-10: Responsável & Colaboradores */}
                                        <div className="desktop:col-span-3 w-full flex items-center justify-between desktop:justify-start gap-3 bg-slate-50 desktop:bg-transparent p-3 desktop:p-0 rounded-xl">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-100 to-fuchsia-100 border-2 border-white shadow-sm flex items-center justify-center shrink-0">
                                                    {record.user_name ? (
                                                        <span className="text-xs font-black text-indigo-700 uppercase">
                                                            {record.user_name.substring(0, 2)}
                                                        </span>
                                                    ) : (
                                                        <User className="w-4 h-4 text-indigo-400" />
                                                    )}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-bold text-slate-700 line-clamp-1 group-hover:text-indigo-600 transition-colors">
                                                        {record.user_name}
                                                    </span>
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                                        <Signature className="w-3 h-3 text-indigo-400" /> Assinado Elet.
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1.5 bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full border border-blue-100 shrink-0">
                                                <Users className="w-3.5 h-3.5" />
                                                <span className="font-bold text-xs">{record.entries.length}</span>
                                            </div>
                                        </div>

                                        {/* Col 11-12: Actions */}
                                        <div className="desktop:col-span-2 w-full flex items-center justify-end gap-2 border-t border-slate-100 desktop:border-t-0 pt-3 desktop:pt-0 mt-1 desktop:mt-0 opacity-100 desktop:opacity-0 desktop:group-hover:opacity-100 transition-opacity duration-300">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onDownloadPdf(record); }}
                                                className="flex-1 desktop:flex-none flex items-center justify-center gap-1.5 px-3 py-2 bg-white border border-slate-200 hover:border-indigo-300 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all shadow-sm group/btn"
                                                title="Baixar PDF"
                                            >
                                                <FileDown className="w-4 h-4" />
                                            </button>

                                            <button
                                                onClick={(e) => { e.stopPropagation(); onEdit(record); }}
                                                className="flex-1 desktop:flex-none flex items-center justify-center gap-1.5 px-3 py-2 bg-white border border-slate-200 hover:border-amber-300 text-slate-600 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all shadow-sm"
                                                title="Editar"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>

                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleDelete(record.id!, record.month); }}
                                                disabled={isRecordDeleting}
                                                className="flex-1 desktop:flex-none flex items-center justify-center gap-1.5 px-3 py-2 bg-white border border-slate-200 hover:border-rose-300 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all shadow-sm disabled:opacity-50"
                                                title="Excluir"
                                            >
                                                {isRecordDeleting ? (
                                                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                                                ) : (
                                                    <Trash2 className="w-4 h-4" />
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

