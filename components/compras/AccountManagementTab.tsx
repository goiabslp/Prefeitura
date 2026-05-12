import React, { useState, useEffect } from 'react';
import {
    Plus, Search, Filter, CheckCircle2, XCircle,
    Clock, Landmark, AlertCircle, Loader2, ChevronRight,
    MoreVertical, Trash2, CheckCircle, User
} from 'lucide-react';
import { PurchaseAccount, User as UserType, Sector } from '../../types';
import { purchaseAccountService } from '../../services/purchaseAccountService';
import { normalizeText } from '../../utils/stringUtils';

interface AccountManagementTabProps {
    currentUser: UserType;
    sectors: Sector[];
}

export const AccountManagementTab: React.FC<AccountManagementTabProps> = ({ currentUser, sectors }) => {
    const [accounts, setAccounts] = useState<PurchaseAccount[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [sectorFilter, setSectorFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState<'all' | 'Ativa' | 'Pendente'>('all');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [newAccount, setNewAccount] = useState({
        agency: '',
        account_number: '',
        description: '',
        ficha: '',
        resolucao: '',
        sector: currentUser.sector || ''
    });

    const isAdmin = currentUser.role === 'admin';

    useEffect(() => {
        fetchAccounts();
    }, []);

    const fetchAccounts = async () => {
        setLoading(true);
        const data = await purchaseAccountService.getAccounts();
        setAccounts(data);
        setLoading(false);
    };

    const handleCreateAccount = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newAccount.agency || !newAccount.account_number || !newAccount.description || !newAccount.sector) {
            alert('Por favor, preencha todos os campos obrigatórios.');
            return;
        }

        setIsSubmitting(true);
        const result = await purchaseAccountService.requestAccount({
            ...newAccount,
            created_by: currentUser.id
        });

        if (result) {
            setAccounts(prev => [...prev, result]);
            setIsModalOpen(false);
            setNewAccount({ agency: '', account_number: '', description: '', ficha: '', resolucao: '', sector: currentUser.sector || '' });
        } else {
            alert('Erro ao solicitar cadastro de conta.');
        }
        setIsSubmitting(false);
    };

    const handleApprove = async (id: string) => {
        const success = await purchaseAccountService.approveAccount(id);
        if (success) {
            setAccounts(prev => prev.map(acc => acc.id === id ? { ...acc, status: 'Ativa' } : acc));
        } else {
            alert('Erro ao aprovar conta.');
        }
    };

    const handleReject = async (id: string) => {
        if (!window.confirm('Deseja realmente rejeitar/excluir esta solicitação?')) return;
        const success = await purchaseAccountService.rejectAccount(id);
        if (success) {
            setAccounts(prev => prev.filter(acc => acc.id !== id));
        } else {
            alert('Erro ao rejeitar conta.');
        }
    };

    const normalizedSearch = normalizeText(searchTerm);

    const filteredAccounts = accounts.filter(acc => {
        const matchesSearch = !normalizedSearch ||
            normalizeText(acc.account_number).includes(normalizedSearch) ||
            normalizeText(acc.description).includes(normalizedSearch);
        const matchesSector = sectorFilter === 'all' || acc.sector === sectorFilter;
        const matchesStatus = statusFilter === 'all' || acc.status === statusFilter;
        return matchesSearch && matchesSector && matchesStatus;
    });

    const pendingAccounts = accounts.filter(acc => acc.status === 'Pendente');

    return (
        <div className="flex flex-col gap-6 animate-fade-in pb-20">
            {/* Header Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
                            <Landmark className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Contas Ativas</p>
                            <p className="text-2xl font-black text-slate-900">{accounts.filter(a => a.status === 'Ativa').length}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm text-amber-600">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center">
                            <Clock className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Solicitações Pendentes</p>
                            <p className="text-2xl font-black text-slate-900">{pendingAccounts.length}</p>
                        </div>
                    </div>
                </div>

                <button
                    onClick={() => setIsModalOpen(true)}
                    className="bg-indigo-600 hover:bg-indigo-700 p-6 rounded-3xl text-white shadow-lg shadow-indigo-600/20 transition-all active:scale-95 flex items-center justify-center gap-3 group"
                >
                    <Plus className="w-6 h-6 group-hover:rotate-90 transition-transform" />
                    <span className="font-bold uppercase tracking-widest text-xs">Nova Conta</span>
                </button>
            </div>

            {/* Admin Approval Section */}
            {isAdmin && pendingAccounts.length > 0 && (
                <div className="bg-amber-50 rounded-3xl border border-amber-100 p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <AlertCircle className="w-5 h-5 text-amber-600" />
                        <h3 className="text-sm font-black text-amber-900 uppercase tracking-tight">Solicitações de Cadastro Aguardando Aprovação</h3>
                    </div>
                    <div className="flex flex-col gap-3">
                        {pendingAccounts.map(acc => (
                            <div key={acc.id} className="bg-white p-4 rounded-2xl border border-amber-200 flex items-center justify-between shadow-sm">
                                <div className="flex flex-col">
                                    <span className="text-xs font-black text-slate-900">Ag: {acc.agency} | CC: {acc.account_number} — {acc.description}</span>
                                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                        Setor: {acc.sector} {acc.ficha && ` | Ficha: ${acc.ficha}`} {acc.resolucao && ` | Resolução: ${acc.resolucao}`}
                                    </span>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleReject(acc.id)}
                                        className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                                        title="Rejeitar"
                                    >
                                        <XCircle className="w-5 h-5" />
                                    </button>
                                    <button
                                        onClick={() => handleApprove(acc.id)}
                                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-md"
                                    >
                                        <CheckCircle2 className="w-4 h-4" /> Aprovar
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Account List Header */}
            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4 flex-1">
                        <div className="relative flex-1 max-w-md">
                            <input
                                type="text"
                                placeholder="Buscar por número ou descrição..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                            />
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        </div>

                        <select
                            value={sectorFilter}
                            onChange={(e) => setSectorFilter(e.target.value)}
                            className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                        >
                            <option value="all">Todos os Setores</option>
                            {sectors.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                        </select>
                    </div>

                    <div className="flex items-center gap-2">
                        {(['all', 'Ativa', 'Pendente'] as const).map(s => (
                            <button
                                key={s}
                                onClick={() => setStatusFilter(s)}
                                className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${statusFilter === s ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-400 border border-slate-200 hover:bg-slate-50'
                                    }`}
                            >
                                {s === 'all' ? 'Ver Tudo' : s}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Table/List Content */}
                <div className="overflow-x-auto">
                    {loading ? (
                        <div className="p-20 flex flex-col items-center justify-center gap-4 text-slate-400">
                            <Loader2 className="w-10 h-10 animate-spin" />
                            <p className="text-xs font-bold uppercase tracking-widest">Carregando Contas...</p>
                        </div>
                    ) : filteredAccounts.length > 0 ? (
                        <table className="w-full">
                            <thead className="bg-slate-50 border-b border-slate-100">
                                <tr>
                                    <th className="px-8 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Conta</th>
                                    <th className="px-8 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Descrição</th>
                                    <th className="px-8 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Ficha / Resolução</th>
                                    <th className="px-8 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Setor</th>
                                    <th className="px-8 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Status</th>
                                    {isAdmin && <th className="px-8 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Ações</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredAccounts.map(acc => (
                                    <tr key={acc.id} className="group hover:bg-slate-50/80 transition-all">
                                        <td className="px-8 py-5">
                                            <span className="font-mono text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg border border-indigo-100">{acc.agency} / {acc.account_number}</span>
                                        </td>
                                        <td className="px-8 py-5">
                                            <span className="text-sm font-bold text-slate-700">{acc.description}</span>
                                        </td>
                                        <td className="px-8 py-5">
                                            <div className="flex flex-col">
                                                {acc.ficha && <span className="text-[11px] font-bold text-slate-500">Ficha: {acc.ficha}</span>}
                                                {acc.resolucao && <span className="text-[11px] font-bold text-slate-500">Res.: {acc.resolucao}</span>}
                                                {!acc.ficha && !acc.resolucao && <span className="text-[11px] font-medium text-slate-400">-</span>}
                                            </div>
                                        </td>
                                        <td className="px-8 py-5">
                                            <div className="flex items-center gap-2">
                                                <div className="w-1.5 h-1.5 rounded-full bg-slate-300"></div>
                                                <span className="text-[11px] font-bold text-slate-500 uppercase">{acc.sector}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5 text-center">
                                            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-wider ${acc.status === 'Ativa' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-amber-50 text-amber-600 border border-amber-100'
                                                }`}>
                                                {acc.status === 'Ativa' ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                                                {acc.status}
                                            </span>
                                        </td>
                                        {isAdmin && (
                                            <td className="px-8 py-5 text-right">
                                                <button
                                                    onClick={() => handleReject(acc.id)}
                                                    className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                                                    title="Excluir Conta"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div className="p-20 flex flex-col items-center justify-center gap-4 text-slate-300 text-center">
                            <Landmark className="w-16 h-16 opacity-10" />
                            <div>
                                <p className="text-sm font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Nenhuma conta encontrada</p>
                                <p className="text-xs font-medium text-slate-300">Tente ajustar seus filtros ou cadastre uma nova conta.</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* NEW ACCOUNT MODAL */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in">
                    <div className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl border border-white/20 overflow-hidden flex flex-col animate-slide-up">
                        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg"><Plus className="w-6 h-6 text-white" /></div>
                                <div><h3 className="text-xl font-black text-slate-900 tracking-tight uppercase">Nova Conta</h3></div>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="p-3 hover:bg-white hover:shadow-md rounded-2xl text-slate-400 transition-all"><ChevronRight className="w-6 h-6 rotate-90" /></button>
                        </div>

                        <form onSubmit={handleCreateAccount} className="p-8 space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Agência</label>
                                    <input
                                        type="text"
                                        value={newAccount.agency}
                                        onChange={(e) => setNewAccount({ ...newAccount, agency: e.target.value })}
                                        placeholder="EX: 0001"
                                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:bg-white focus:border-indigo-500 transition-all font-mono font-bold"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Número da Conta</label>
                                    <input
                                        type="text"
                                        value={newAccount.account_number}
                                        onChange={(e) => setNewAccount({ ...newAccount, account_number: e.target.value })}
                                        placeholder="EX: 100, 110, 200..."
                                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:bg-white focus:border-indigo-500 transition-all font-mono font-bold"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Descrição da Conta</label>
                                <input
                                    type="text"
                                    value={newAccount.description}
                                    onChange={(e) => setNewAccount({ ...newAccount, description: e.target.value })}
                                    placeholder="Ex: Recurso Próprio, Convênio Federal..."
                                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:bg-white focus:border-indigo-500 transition-all font-bold"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Ficha</label>
                                    <input
                                        type="text"
                                        value={newAccount.ficha}
                                        onChange={(e) => setNewAccount({ ...newAccount, ficha: e.target.value })}
                                        placeholder="EX: 12345"
                                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:bg-white focus:border-indigo-500 transition-all font-mono font-bold"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Resolução</label>
                                    <input
                                        type="text"
                                        value={newAccount.resolucao}
                                        onChange={(e) => setNewAccount({ ...newAccount, resolucao: e.target.value })}
                                        placeholder="EX: Resolução 123/2024"
                                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:bg-white focus:border-indigo-500 transition-all font-bold"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Setor de Atuação</label>
                                <select
                                    value={newAccount.sector}
                                    onChange={(e) => setNewAccount({ ...newAccount, sector: e.target.value })}
                                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:bg-white focus:border-indigo-500 transition-all font-bold text-slate-700"
                                >
                                    <option value="">Selecione um Setor</option>
                                    {sectors.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                                </select>
                            </div>

                            <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 flex gap-3 text-blue-600">
                                <AlertCircle className="w-5 h-5 shrink-0" />
                                <p className="text-[11px] font-bold leading-tight">Nova conta ficará com status <span className="underline">Pendente</span> até que um administrador aprove.</p>
                            </div>

                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full py-4 bg-slate-900 text-white font-black text-xs uppercase tracking-[0.2em] rounded-2xl shadow-xl hover:bg-indigo-600 transition-all active:scale-95 flex items-center justify-center gap-3"
                            >
                                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><CheckCircle2 className="w-5 h-5" /> Solicitar Cadastro</>}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
