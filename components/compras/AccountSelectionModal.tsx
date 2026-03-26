import React, { useState, useEffect } from 'react';
import {
    X, Search, Plus, Landmark, CheckCircle2,
    ArrowRight, Loader2, AlertCircle, CreditCard,
    DollarSign, Briefcase, User, MapPin
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { PurchaseAccount, User as UserType, Sector, Order } from '../../types';
import { purchaseAccountService } from '../../services/purchaseAccountService';

interface AccountSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (account: PurchaseAccount, advanceStatus: boolean) => void;
    currentUser: UserType;
    sectors: Sector[];
    order?: Order;
    isAdmin?: boolean;
    isSuccess?: boolean;
}

export const AccountSelectionModal: React.FC<AccountSelectionModalProps> = ({
    isOpen,
    onClose,
    onSelect,
    currentUser,
    sectors,
    order,
    isAdmin = false,
    isSuccess = false
}) => {
    const currentAccountDesc = order?.documentSnapshot?.content?.selectedAccount;
    const [accounts, setAccounts] = useState<PurchaseAccount[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [isSelecting, setIsSelecting] = useState(!currentAccountDesc);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // New Account Form State
    const [newAccount, setNewAccount] = useState({
        agency: '',
        account_number: '',
        description: '',
        sector: currentUser.sector || ''
    });

    useEffect(() => {
        if (isOpen) {
            fetchAccounts();
        }
    }, [isOpen]);

    const fetchAccounts = async () => {
        setLoading(true);
        const data = await purchaseAccountService.getAccounts();
        // Only show Active accounts for selection
        setAccounts(data.filter(acc => acc.status === 'Ativa'));
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
            alert('Solicitação enviada! A conta aparecerá na lista assim que for aprovada por um administrador.');
            setIsCreating(false);
            setNewAccount({ agency: '', account_number: '', description: '', sector: currentUser.sector || '' });
            // Optionally re-fetch, but it will be "Pendente" so it won't show in the selector anyway
        } else {
            alert('Erro ao solicitar cadastro de conta.');
        }
        setIsSubmitting(false);
    };

    const filteredAccounts = accounts.filter(acc =>
        acc.account_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        acc.description.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in">
            <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl border border-white/20 overflow-hidden flex flex-col max-h-[90vh]"
            >
                {/* HEADER */}
                <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-600/20">
                            <Landmark className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-slate-900 tracking-tight uppercase">Conta de Pagamento</h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Selecione ou cadastre a conta para este pedido</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-3 hover:bg-white hover:shadow-md rounded-2xl text-slate-400 transition-all">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="flex-1 overflow-hidden flex flex-col relative">
                    <AnimatePresence>
                        {isSuccess && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="absolute inset-0 z-[50] bg-white flex flex-col items-center justify-center p-8 text-center"
                            >
                                <motion.div
                                    initial={{ scale: 0.5, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    transition={{ type: "spring", damping: 12, stiffness: 200 }}
                                    className="w-24 h-24 bg-emerald-500 rounded-[2.5rem] flex items-center justify-center mb-6 shadow-2xl shadow-emerald-500/20"
                                >
                                    <CheckCircle2 className="w-12 h-12 text-white" />
                                </motion.div>
                                <motion.h4
                                    initial={{ y: 20, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    transition={{ delay: 0.2 }}
                                    className="text-3xl font-black text-slate-900 uppercase tracking-tighter"
                                >
                                    Pronto!
                                </motion.h4>
                                <motion.p
                                    initial={{ y: 20, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    transition={{ delay: 0.3 }}
                                    className="text-slate-500 font-bold mt-2"
                                >
                                    O status foi atualizado com sucesso.
                                </motion.p>
                            </motion.div>
                        )}
                    </AnimatePresence>
                    {!isSelecting ? (
                        <div className="flex-1 p-8 flex flex-col items-center justify-center animate-fade-in">
                            <h4 className="text-xl font-black text-slate-800 uppercase mb-4 tracking-tight">Conta Selecionada</h4>
                            <div className="w-full max-w-md p-6 bg-indigo-50/50 border border-indigo-100 rounded-[2rem] mb-8 text-center shadow-sm">
                                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block mb-2"><Landmark className="w-4 h-4 inline-block mb-1" /> CONTA</span>
                                <span className="text-lg font-black text-indigo-900">{currentAccountDesc}</span>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
                                <button
                                    onClick={() => setIsSelecting(true)}
                                    className="flex-1 py-4 bg-white border border-slate-200 text-slate-600 shadow-sm font-black text-[11px] uppercase tracking-widest rounded-2xl hover:bg-slate-50 transition-all active:scale-95 text-center flex items-center justify-center gap-2"
                                >
                                    Alterar Conta
                                </button>
                                {isAdmin && (
                                    <button
                                        onClick={() => {
                                            const approvedAcc = accounts.find(a => a.description === currentAccountDesc) || { description: currentAccountDesc } as PurchaseAccount;
                                            onSelect(approvedAcc, true);
                                        }}
                                        className="flex-1 py-4 bg-emerald-600 border border-emerald-500 text-white shadow-xl shadow-emerald-600/20 font-black text-[11px] uppercase tracking-widest rounded-2xl hover:bg-emerald-700 transition-all active:scale-95 text-center flex items-center justify-center gap-2 block"
                                    >
                                        <CheckCircle2 className="w-4 h-4" /> Aprovar Conta
                                    </button>
                                )}
                            </div>
                        </div>
                    ) : !isCreating ? (
                        <>
                            {/* SEARCH & ACTION */}
                            <div className="p-8 border-b border-slate-50 flex items-center gap-4">
                                <div className="relative flex-1 group">
                                    <input
                                        type="text"
                                        placeholder="Buscar por número ou descrição..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                                    />
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                </div>
                                <button
                                    onClick={() => setIsCreating(true)}
                                    className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20 active:scale-95 whitespace-nowrap"
                                >
                                    <Plus className="w-4 h-4" /> Nova Conta
                                </button>
                            </div>

                            {/* LIST */}
                            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                                {loading ? (
                                    <div className="h-60 flex flex-col items-center justify-center gap-4 text-slate-400">
                                        <Loader2 className="w-10 h-10 animate-spin" />
                                        <p className="text-xs font-bold uppercase tracking-widest">Carregando Contas...</p>
                                    </div>
                                ) : filteredAccounts.length > 0 ? (
                                    <div className="grid grid-cols-1 gap-3">
                                        {filteredAccounts.map(acc => (
                                            <button
                                                key={acc.id}
                                                onClick={() => onSelect(acc, false)}
                                                className="group text-left p-6 bg-white border border-slate-100 rounded-[2rem] hover:border-indigo-500 hover:shadow-xl hover:shadow-indigo-500/5 transition-all flex items-center justify-between"
                                            >
                                                <div className="flex items-center gap-5">
                                                    <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center group-hover:bg-indigo-50 transition-colors">
                                                        <CreditCard className="w-6 h-6 text-slate-400 group-hover:text-indigo-600 transition-colors" />
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="text-[10px] font-black text-slate-800 uppercase tracking-widest">{acc.description}</span>
                                                        </div>
                                                        <h4 className="text-base font-black text-slate-700 group-hover:text-slate-900 transition-colors">{acc.sector}</h4>
                                                        <span className="text-xs font-medium text-slate-500 flex items-center gap-2">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
                                                            Ag: <span className="font-mono">{acc.agency}</span> / CC: <span className="font-mono">{acc.account_number}</span>
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="w-10 h-10 rounded-full border border-slate-100 flex items-center justify-center text-slate-300 group-hover:bg-indigo-600 group-hover:border-indigo-600 group-hover:text-white transition-all">
                                                    <ArrowRight className="w-5 h-5 group-hover:scale-110 transition-transform" />
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="h-60 flex flex-col items-center justify-center gap-4 text-slate-300">
                                        <Landmark className="w-20 h-20 opacity-10" />
                                        <div className="text-center">
                                            <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Nenhuma conta ativa encontrada</p>
                                            <p className="text-xs font-medium">Cadastre uma nova conta ou aguarde aprovação.</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        /* CREATE NEW FORM */
                        <form onSubmit={handleCreateAccount} className="p-8 flex-1 overflow-y-auto custom-scrollbar">
                            <div className="flex items-center gap-3 mb-8 bg-blue-50/50 p-4 rounded-3xl border border-blue-100/50">
                                <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
                                    <AlertCircle className="w-5 h-5" />
                                </div>
                                <p className="text-[11px] font-bold text-blue-800 leading-tight italic">
                                    "Novas contas exigem validação administrativa antes de estarem disponíveis para seleção."
                                </p>
                            </div>

                            <div className="space-y-6">
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
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block ml-2">Descrição Completa</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={newAccount.description}
                                            onChange={(e) => setNewAccount({ ...newAccount, description: e.target.value })}
                                            placeholder="Ex: Recurso Próprio, Convênio Federal..."
                                            className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-[1.5rem] outline-none focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-bold"
                                        />
                                        <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block ml-2">Setor Responsável</label>
                                    <div className="relative">
                                        <select
                                            value={newAccount.sector}
                                            onChange={(e) => setNewAccount({ ...newAccount, sector: e.target.value })}
                                            className="w-full pl-12 pr-10 py-4 bg-slate-50 border border-slate-200 rounded-[1.5rem] outline-none focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-bold text-slate-700 appearance-none"
                                        >
                                            <option value="">Selecione um Setor</option>
                                            {sectors.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                                        </select>
                                        <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                                    </div>
                                </div>
                            </div>

                            <div className="mt-10 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsCreating(false)}
                                    className="flex-1 py-4 bg-white text-slate-400 font-black text-xs uppercase tracking-widest rounded-2xl border border-slate-200 hover:bg-slate-50 hover:text-slate-600 transition-all"
                                >
                                    Voltar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="flex-[2] py-4 bg-slate-900 text-white font-black text-xs uppercase tracking-[0.2em] rounded-2xl shadow-xl hover:bg-indigo-600 transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50"
                                >
                                    {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><CheckCircle2 className="w-5 h-5" /> Solicitar Cadastro</>}
                                </button>
                            </div>
                        </form>
                    )}
                </div>

                {/* FOOTER */}
                <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-center">
                    <div className="flex items-center gap-2 text-[10px] font-black text-slate-300 uppercase tracking-widest">
                        <Lock className="w-3 h-3" />
                        Ação auditada e vinculada ao usuário {currentUser.name}
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

// Re-importing ChevronDown since it was missed in main import but used in form
import { ChevronDown, Lock } from 'lucide-react';
