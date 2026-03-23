import React, { useState, useEffect } from 'react';
import { RhHorasExtras } from '../../types';
import { getRhHorasExtrasHistory, deleteRhHorasExtras } from '../../services/rhService';
import { FileDown, Calendar, Users, Signature, FileText, Search, Trash2, Edit2 } from 'lucide-react';

interface HorasExtrasHistoryProps {
    onDownloadPdf: (record: RhHorasExtras) => void;
    onEdit: (record: RhHorasExtras) => void;
    highlightId?: string | null;
    userRole: string;
    currentUserSector: string;
}

export const HorasExtrasHistory: React.FC<HorasExtrasHistoryProps> = ({
    onDownloadPdf,
    onEdit,
    highlightId,
    userRole,
    currentUserSector
}) => {
    const [history, setHistory] = useState<RhHorasExtras[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isDeleting, setIsDeleting] = useState<string | null>(null);

    useEffect(() => {
        loadHistory();
    }, []);

    const loadHistory = async () => {
        setIsLoading(true);
        try {
            const { data } = await getRhHorasExtrasHistory(1, 100);
            setHistory(data);
        } catch (error) {
            console.error('Error loading Horas Extras history:', error);
        } finally {
            setIsLoading(false);
        }
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
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                <div>
                    <h2 className="text-xl font-semibold text-slate-800">Histórico de Lançamentos</h2>
                    <p className="text-sm text-slate-500">Visualização de planilhas de horas extras aprovadas</p>
                </div>

                <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Buscar por mês, setor, usuário..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-white/50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                    />
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-center border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                                <th className="py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider text-center">Mês / Ano</th>
                                <th className="py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider text-center">Data do Lançamento</th>
                                <th className="py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider text-center">Setor</th>
                                <th className="py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider text-center">Colaboradores</th>
                                <th className="py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider text-center">Responsável</th>
                                <th className="py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider text-center">Ação</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={6} className="py-8 text-center text-slate-500">
                                        <div className="flex flex-col justify-center items-center gap-2">
                                            <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                                            <span>Carregando histórico...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredHistory.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="py-8 text-center text-slate-500">
                                        <div className="flex flex-col justify-center items-center gap-2">
                                            <FileText className="h-8 w-8 text-slate-300" />
                                            <span>Nenhum lançamento encontrado.</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredHistory.map((record) => {
                                    const isHighlighted = record.id === highlightId;
                                    const isRecordDeleting = isDeleting === record.id;

                                    return (
                                        <tr
                                            key={record.id}
                                            className={`transition-all duration-700 border-l-4 ${isHighlighted ? 'bg-indigo-50/80 border-indigo-500' : 'hover:bg-slate-50 border-transparent'} ${isRecordDeleting ? 'opacity-50 pointer-events-none' : ''}`}
                                        >
                                            <td className="py-3 px-4 text-center">
                                                <div className="flex items-center justify-center gap-2 text-sm font-medium text-slate-800">
                                                    <Calendar className="h-4 w-4 text-indigo-500" />
                                                    <span>{record.month}</span>
                                                </div>
                                            </td>
                                            <td className="py-3 px-4 text-sm text-slate-600 text-center">
                                                {formatDate(record.created_at)}
                                            </td>
                                            <td className="py-3 px-4 text-sm text-slate-600 text-center">
                                                {record.sector}
                                            </td>
                                            <td className="py-3 px-4 text-sm text-slate-600 text-center">
                                                <div className="flex items-center justify-center gap-1.5 bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full w-fit mx-auto border border-blue-100">
                                                    <Users className="h-3.5 w-3.5" />
                                                    <span className="font-medium text-xs">{record.entries.length}</span>
                                                </div>
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold uppercase">
                                                        {record.user_name.slice(0, 2)}
                                                    </div>
                                                    <div className="flex flex-col items-start">
                                                        <span className="text-sm font-medium text-slate-800">{record.user_name}</span>
                                                        <span className="text-xs text-slate-500 flex items-center gap-1">
                                                            <Signature className="h-3 w-3" /> Assinado Elet.
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    <button
                                                        onClick={() => onEdit(record)}
                                                        className="inline-flex items-center justify-center gap-1.5 text-xs font-medium bg-white text-slate-700 hover:text-indigo-600 hover:bg-slate-50 border border-slate-200 hover:border-indigo-200 px-2.5 py-1.5 rounded-md transition-all shadow-sm"
                                                        title="Editar Lançamento"
                                                    >
                                                        <Edit2 className="h-4 w-4" />
                                                        <span className="hidden sm:inline">Editar</span>
                                                    </button>
                                                    <button
                                                        onClick={() => onDownloadPdf(record)}
                                                        className="inline-flex items-center justify-center gap-1.5 text-xs font-medium bg-white text-slate-700 hover:text-indigo-600 hover:bg-slate-50 border border-slate-200 hover:border-indigo-200 px-2.5 py-1.5 rounded-md transition-all shadow-sm"
                                                        title="Baixar PDF"
                                                    >
                                                        <FileDown className="h-4 w-4" />
                                                        <span className="hidden sm:inline">Baixar</span>
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(record.id!, record.month)}
                                                        disabled={isRecordDeleting}
                                                        className="inline-flex items-center justify-center gap-1.5 text-xs font-medium bg-white text-rose-600 hover:text-white hover:bg-rose-600 border border-slate-200 hover:border-rose-600 px-2.5 py-1.5 rounded-md transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                                        title="Excluir Registro"
                                                    >
                                                        {isRecordDeleting ? (
                                                            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                                                        ) : (
                                                            <Trash2 className="h-4 w-4" />
                                                        )}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
