import React, { useState } from 'react';
import { ArrowLeft, Search, Filter, FileText, ChevronRight, Gavel, Calendar, Clock, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import { User } from '../../types';
import { useLicitacaoProcesses } from '../../hooks/useLicitacaoModule';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface LicitacaoListProps {
    currentUser: User;
    onBack: () => void;
}

export const LicitacaoList: React.FC<LicitacaoListProps> = ({ currentUser, onBack }) => {
    const { data: processes, isLoading } = useLicitacaoProcesses();
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('Todos');

    const filteredProcesses = processes?.filter(process => {
        const matchesSearch = process.finalidade.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              process.protocolo?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'Todos' || process.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Rascunho': return 'bg-slate-100 text-slate-600 border-slate-200';
            case 'Em Analise': return 'bg-amber-50 text-amber-600 border-amber-200';
            case 'Aprovado': return 'bg-emerald-50 text-emerald-600 border-emerald-200';
            case 'Rejeitado': return 'bg-rose-50 text-rose-600 border-rose-200';
            case 'Concluido': return 'bg-indigo-50 text-indigo-600 border-indigo-200';
            default: return 'bg-slate-50 text-slate-500 border-slate-200';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'Em Analise': return <Clock className="w-3 h-3" />;
            case 'Aprovado': return <CheckCircle2 className="w-3 h-3" />;
            case 'Rejeitado': return <XCircle className="w-3 h-3" />;
            case 'Concluido': return <CheckCircle2 className="w-3 h-3" />;
            default: return <AlertCircle className="w-3 h-3" />;
        }
    };

    return (
        <div className="flex-1 flex flex-col font-sans animate-in fade-in duration-300 bg-[#FAFAFA] overflow-hidden relative z-10">
            {/* Header */}
            <header className="h-20 bg-white border-b border-slate-200 px-6 flex items-center justify-between shadow-sm shrink-0">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onBack}
                        className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-slate-100 text-slate-500 transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-xl font-black text-slate-800">Meus Processos Licitatórios</h1>
                        <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">Acompanhamento</p>
                    </div>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-6 md:p-8">
                <div className="max-w-6xl mx-auto space-y-6">
                    
                    {/* Filters & Actions */}
                    <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                        <div className="flex-1 w-full relative">
                            <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                            <input 
                                type="text"
                                placeholder="Buscar por finalidade ou número..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                            />
                        </div>
                        <div className="flex gap-2 w-full md:w-auto">
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="w-full md:w-48 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-slate-700"
                            >
                                <option value="Todos">Todos os Status</option>
                                <option value="Rascunho">Rascunho</option>
                                <option value="Em Analise">Em Análise</option>
                                <option value="Aprovado">Aprovado</option>
                                <option value="Rejeitado">Rejeitado</option>
                                <option value="Concluido">Concluído</option>
                            </select>
                        </div>
                    </div>

                    {/* Content List */}
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center p-20">
                            <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
                            <p className="text-slate-500 font-bold">Carregando processos...</p>
                        </div>
                    ) : filteredProcesses?.length === 0 ? (
                        <div className="flex flex-col items-center justify-center bg-white rounded-3xl border border-slate-100 p-20 text-center">
                            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                                <Gavel className="w-10 h-10 text-slate-300" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-800 mb-2">Nenhum processo encontrado</h3>
                            <p className="text-slate-500">Tente ajustar os filtros ou busque por outro termo.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredProcesses?.map((process) => (
                                <div 
                                    key={process.id} 
                                    className="group bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_4px_20px_rgb(0,0,0,0.02)] hover:shadow-[0_10px_30px_rgb(0,0,0,0.06)] hover:-translate-y-1 transition-all duration-300 relative overflow-hidden flex flex-col cursor-pointer"
                                    title={process.finalidade || 'Finalidade não especificada'}
                                >
                                    <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                    
                                    <div className="flex justify-between items-start mb-4">
                                        <div className={`px-3 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${getStatusColor(process.status)}`}>
                                            {getStatusIcon(process.status)}
                                            {process.status}
                                        </div>
                                        <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                                            <FileText className="w-4 h-4" />
                                        </div>
                                    </div>

                                    <h3 className="text-lg font-bold text-slate-800 mb-2 line-clamp-2" title={process.finalidade}>
                                        {process.finalidade}
                                    </h3>
                                    
                                    <div className="mt-auto pt-4 border-t border-slate-100 space-y-2">
                                        <div className="flex items-center text-xs text-slate-500 gap-2">
                                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                            <span>Criado em {format(new Date(process.criado_em), "dd/MM/yyyy", { locale: ptBR })}</span>
                                        </div>
                                        {process.protocolo && (
                                            <div className="flex items-center text-xs text-slate-500 gap-2 font-mono bg-slate-50 px-2 py-1 rounded self-start">
                                                Nº {process.protocolo}
                                            </div>
                                        )}
                                    </div>
                                    
                                    <div className="absolute bottom-6 right-6 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0">
                                        <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/30">
                                            <ChevronRight className="w-4 h-4" />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
