import React, { useState, useEffect, useRef } from 'react';
import { User, Sector, Projeto, ProjetoHistory, ProjetoStatus } from '../../types';
import { getProjetoById, getProjetoHistory, forwardProjeto, addProjetoMessage } from '../../services/projetosService';
import { ArrowLeft, Send, Paperclip, MessageSquare, CornerUpRight, AlertCircle, FileText, CheckCircle2, History, User as UserIcon, Network, Calendar, Layout, Clock, Info, Shield, CheckCircle, XCircle, Plus, Eye, Edit3, Download, MapPin, Hash, Loader2 } from 'lucide-react';
import { useNotification } from '../../contexts/NotificationContext';
import { supabase } from '../../services/supabaseClient';

interface ProjetoDetailsProps {
    projetoId: string;
    userId: string;
    userRole: string;
    currentUserSector?: string;
    users: User[];
    sectors: Sector[];
    onBack: () => void;
}

export const ProjetoDetails: React.FC<ProjetoDetailsProps> = ({
    projetoId,
    userId,
    userRole,
    currentUserSector,
    users,
    sectors,
    onBack
}) => {
    const { addNotification } = useNotification();
    const [projeto, setProjeto] = useState<Projeto | null>(null);
    const [history, setHistory] = useState<ProjetoHistory[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [messageDraft, setMessageDraft] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Forwarding state
    const [showForwardForm, setShowForwardForm] = useState(false);
    const [forwardTargetUser, setForwardTargetUser] = useState('');
    const [forwardTargetSector, setForwardTargetSector] = useState('');
    const [forwardStatus, setForwardStatus] = useState<ProjetoStatus | ''>('');
    const [forwardMessage, setForwardMessage] = useState('');

    const loadData = async () => {
        setIsLoading(true);
        const [proj, hist] = await Promise.all([
            getProjetoById(projetoId),
            getProjetoHistory(projetoId)
        ]);
        setProjeto(proj);
        setHistory(hist);
        setIsLoading(false);
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        loadData();
    }, [projetoId]);

    // Realtime changes listener for history and project updates
    useEffect(() => {
        const histChannel = supabase.channel(`public:projeto_history:${projetoId}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'projeto_history', filter: `project_id=eq.${projetoId}` },
                (payload) => {
                    const newHist = payload.new as any;
                    setHistory(prev => [...prev, newHist]);
                    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
                }
            ).subscribe();

        const projChannel = supabase.channel(`public:projetos:${projetoId}`)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'projetos', filter: `id=eq.${projetoId}` },
                (payload) => {
                    setProjeto(payload.new as Projeto);
                }
            ).subscribe();

        return () => {
            supabase.removeChannel(histChannel);
            supabase.removeChannel(projChannel);
        };
    }, [projetoId]);

    if (isLoading || !projeto) {
        return (
            <div className="flex items-center justify-center min-h-[500px]">
                <div className="w-10 h-10 border-4 border-fuchsia-600 border-t-transparent flex items-center justify-center rounded-full animate-spin"></div>
            </div>
        );
    }

    const currentOwner = users.find(u => u.id === projeto.current_owner_id);
    const currentSector = sectors.find(s => s.id === projeto.current_sector_id);
    const creator = users.find(u => u.id === projeto.created_by);
    const responsible = users.find(u => u.id === projeto.responsible_id);

    const isCurrentOwner = projeto.current_owner_id === userId;
    const isCurrentSector = projeto.current_sector_id === currentUserSector;
    const canInteract = userRole === 'admin' || isCurrentOwner || isCurrentSector;

    const handleSendMessage = async () => {
        if (!messageDraft.trim()) return;
        setIsSubmitting(true);
        try {
            await addProjetoMessage(projetoId, userId, currentUserSector, messageDraft.trim());
            setMessageDraft('');
            addNotification('Mensagem enviada com sucesso.', 'success');
        } catch (error) {
            addNotification('Erro ao enviar mensagem.', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleForward = async () => {
        if (!forwardTargetUser && !forwardTargetSector && !forwardStatus) {
            addNotification('Preencha o destino ou novo status.', 'info');
            return;
        }

        setIsSubmitting(true);
        try {
            const finalStatus = forwardStatus ? forwardStatus as ProjetoStatus : undefined;
            await forwardProjeto(
                projetoId,
                userId,
                currentUserSector,
                forwardTargetUser || null,
                forwardTargetSector || null,
                forwardMessage.trim() || 'Projeto movimentado.',
                finalStatus
            );

            setShowForwardForm(false);
            setForwardTargetUser('');
            setForwardTargetSector('');
            setForwardStatus('');
            setForwardMessage('');
            addNotification('Projeto encaminhado com sucesso!', 'success');
        } catch (error) {
            addNotification('Erro ao encaminhar projeto.', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-100/30 font-sans p-4 desktop:p-8 flex items-center justify-center animate-fade-in overflow-hidden">
            <div className="w-full max-w-[1400px] h-[calc(100vh-6rem)] bg-white rounded-[2.5rem] shadow-[0_25px_70px_-15px_rgba(0,0,0,0.15)] border border-slate-200 overflow-hidden flex flex-col animate-slide-up">

                {/* GLOBAL HEADER */}
                <header className="px-8 py-5 border-b border-slate-100 bg-white flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={onBack}
                            className="p-3 bg-slate-50 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-2xl transition-all active:scale-95 group"
                            title="Voltar"
                        >
                            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                        </button>
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] bg-indigo-50 px-2 py-0.5 rounded-md">Projeto Ativo</span>
                                <span className="text-[10px] font-bold text-slate-400 font-mono tracking-tight">{projeto.id.slice(0, 8).toUpperCase()}</span>
                            </div>
                            <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-tight">{projeto.name}</h1>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className={`px-4 py-2 rounded-2xl text-xs font-black uppercase tracking-widest border shadow-sm flex items-center gap-2 ${projeto.status === 'Concluído' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                            projeto.status === 'Cancelado' ? 'bg-rose-50 text-rose-700 border-rose-100' :
                                'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-100'
                            }`}>
                            {projeto.status === 'Concluído' ? <CheckCircle2 className="w-4 h-4" /> :
                                projeto.status === 'Cancelado' ? <XCircle className="w-4 h-4" /> :
                                    <Clock className="w-4 h-4 animate-pulse" />}
                            {projeto.status}
                        </div>

                        {canInteract && !showForwardForm && (
                            <button
                                onClick={() => setShowForwardForm(true)}
                                className="bg-slate-900 text-white px-6 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/10 active:scale-95"
                            >
                                <CornerUpRight className="w-4 h-4" />
                                Encaminhar
                            </button>
                        )}
                    </div>
                </header>

                <main className="flex-1 flex flex-col md:flex-row overflow-hidden">
                    {/* SIDEBAR: Project Info */}
                    <aside className="w-full md:w-[320px] lg:w-[380px] bg-slate-50/50 border-r border-slate-100 flex flex-col overflow-y-auto custom-scrollbar shrink-0">
                        <div className="p-8 space-y-8">

                            {/* OWNER SECTION */}
                            <section>
                                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                                    <Shield className="w-3.5 h-3.5" /> Posse & Localização
                                </h3>
                                <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4">
                                    <div className="flex items-start gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                                            <Network className="w-5 h-5 text-indigo-600" />
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Setor Atual</p>
                                            <p className="text-sm font-bold text-slate-800">{currentSector?.name || 'Sem setor atribuído'}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-fuchsia-50 flex items-center justify-center shrink-0">
                                            <UserIcon className="w-5 h-5 text-fuchsia-600" />
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Responsável Atual</p>
                                            <p className="text-sm font-bold text-slate-800">{currentOwner?.name || 'Qualquer usuário do setor'}</p>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            {/* PROJECT DETAILS */}
                            <section>
                                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                                    <Info className="w-3.5 h-3.5" /> Detalhes Técnicos
                                </h3>
                                <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-6">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                                                <Calendar className="w-3 h-3 text-indigo-400" /> Início
                                            </p>
                                            <p className="text-xs font-bold text-slate-700">{projeto.start_date ? new Date(projeto.start_date).toLocaleDateString('pt-BR') : '---'}</p>
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                                                <Calendar className="w-3 h-3 text-rose-400" /> Fim
                                            </p>
                                            <p className="text-xs font-bold text-slate-700">{projeto.end_date ? new Date(projeto.end_date).toLocaleDateString('pt-BR') : '---'}</p>
                                        </div>
                                    </div>

                                    <div className="h-px bg-slate-100" />

                                    <div>
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Responsável Geral</p>
                                        <div className="flex items-center gap-2">
                                            <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center text-[10px] font-black text-indigo-600">
                                                {responsible?.name?.charAt(0) || 'R'}
                                            </div>
                                            <span className="text-xs font-bold text-slate-700">{responsible?.name || 'Não definido'}</span>
                                        </div>
                                    </div>

                                    <div>
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Criado por</p>
                                        <div className="flex items-center gap-2">
                                            <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-500">
                                                {creator?.name?.charAt(0) || 'S'}
                                            </div>
                                            <span className="text-xs font-bold text-slate-600">{creator?.name || 'Sistema'}</span>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            {/* DESCRIPTION */}
                            <section>
                                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                                    <FileText className="w-3.5 h-3.5" /> Descrição do Projeto
                                </h3>
                                <div className="bg-indigo-900 text-white rounded-[2rem] p-6 shadow-xl shadow-indigo-900/10 relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                                        <FileText className="w-12 h-12" />
                                    </div>
                                    <p className="text-xs font-medium leading-relaxed opacity-90 relative z-10">
                                        {projeto.description || 'Este projeto não possui uma descrição detalhada cadastrada até o momento.'}
                                    </p>
                                </div>
                            </section>
                        </div>
                    </aside>

                    {/* MAIN: History & Interaction */}
                    <div className="flex-1 flex flex-col bg-slate-50 relative overflow-hidden">

                        {/* FORWARD FORM OVERLAY (ABSOLUTE) */}
                        {showForwardForm && (
                            <div className="absolute inset-0 z-50 bg-slate-900/40 backdrop-blur-sm p-4 desktop:p-8 flex items-start justify-center overflow-y-auto animate-fade-in scrollbar-hide">
                                <div className="w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl border border-white/20 overflow-hidden animate-slide-up">
                                    <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-white">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-600/20">
                                                <CornerUpRight className="w-6 h-6 text-white" />
                                            </div>
                                            <div>
                                                <h3 className="text-xl font-black text-slate-900 tracking-tight uppercase">Movimentar Projeto</h3>
                                                <p className="text-xs font-bold text-indigo-600 font-mono">DEFINA O DESTINO OU NOVO STATUS</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setShowForwardForm(false)}
                                            className="p-3 hover:bg-slate-50 rounded-2xl text-slate-400 hover:text-slate-900 transition-all active:scale-90"
                                        >
                                            <XCircle className="w-6 h-6" />
                                        </button>
                                    </div>

                                    <div className="p-8 space-y-6">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Para Setor</label>
                                                <div className="relative group">
                                                    <select
                                                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all appearance-none cursor-pointer"
                                                        value={forwardTargetSector}
                                                        onChange={e => setForwardTargetSector(e.target.value)}
                                                    >
                                                        <option value="">-- Manter ou Escolher Setor --</option>
                                                        {sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                                    </select>
                                                    <Network className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Para Usuário</label>
                                                <div className="relative group">
                                                    <select
                                                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all appearance-none cursor-pointer"
                                                        value={forwardTargetUser}
                                                        onChange={e => setForwardTargetUser(e.target.value)}
                                                    >
                                                        <option value="">-- Todos do setor --</option>
                                                        {users.filter(u => forwardTargetSector ? u.sectorId === forwardTargetSector : true).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                                    </select>
                                                    <UserIcon className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                                </div>
                                            </div>
                                            <div className="md:col-span-2 space-y-2">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Alterar Status</label>
                                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                                                    {['Em Andamento', 'Concluído', 'Cancelado'].map(status => (
                                                        <button
                                                            key={status}
                                                            onClick={() => setForwardStatus(status as any)}
                                                            className={`py-3 px-4 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all ${forwardStatus === status
                                                                ? 'bg-slate-900 text-white border-slate-900 shadow-lg'
                                                                : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                                                                }`}
                                                        >
                                                            {status}
                                                        </button>
                                                    ))}
                                                    <button
                                                        onClick={() => setForwardStatus('')}
                                                        className={`py-3 px-4 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all ${forwardStatus === ''
                                                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg'
                                                            : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'
                                                            }`}
                                                    >
                                                        Manter Atual
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Justificativa / Messagem</label>
                                            <textarea
                                                className="w-full bg-slate-50 border border-slate-200 rounded-[2rem] px-6 py-4 text-sm font-medium text-slate-700 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all resize-none h-32"
                                                placeholder="Descreva o motivo da movimentação ou observações importantes..."
                                                value={forwardMessage}
                                                onChange={e => setForwardMessage(e.target.value)}
                                            />
                                        </div>

                                        <button
                                            onClick={handleForward}
                                            disabled={isSubmitting}
                                            className="bg-slate-900 text-white w-full py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/20 flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-50"
                                        >
                                            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                            {isSubmitting ? 'Processando...' : 'Confirmar Movimentação'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* HISTORY BAR */}
                        <div className="bg-white px-8 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-2">
                                <History className="w-4 h-4 text-indigo-500" />
                                <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Cronologia do Projeto</h3>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{history.length} Eventos</span>
                            </div>
                        </div>

                        {/* Chat History Container */}
                        <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar bg-slate-50/50 relative">
                            <div className="absolute left-[54px] top-8 bottom-8 w-px bg-slate-200 hidden md:block" />

                            {history.map((hist, index) => {
                                const isMe = hist.user_id === userId;
                                const actionUser = users.find(u => u.id === hist.user_id);
                                const isSystem = !hist.user_id || hist.action === 'Criado';

                                return (
                                    <div key={hist.id} className={`flex items-start gap-4 transition-all animate-fade-in`} style={{ animationDelay: `${index * 50}ms` }}>
                                        {/* Ícone do Autor */}
                                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-sm z-10 border-4 border-white ${isSystem ? 'bg-slate-100 text-slate-500' :
                                            isMe ? 'bg-indigo-600 text-white' : 'bg-white text-slate-700'
                                            }`}>
                                            {isSystem ? <Layout className="w-4 h-4" /> :
                                                isMe ? <UserIcon className="w-4 h-4" /> :
                                                    <UserIcon className="w-4 h-4" />}
                                        </div>

                                        <div className="flex-1 space-y-2">
                                            <div className="flex items-baseline gap-2">
                                                <span className="text-[10px] font-black text-slate-800 uppercase tracking-widest">
                                                    {isSystem ? 'Sistema' : actionUser?.name || 'Usuário'}
                                                </span>
                                                <span className="text-[9px] font-bold text-slate-400">
                                                    {new Date(hist.created_at || '').toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                                <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-[0.1em] border ${hist.action === 'Encaminhado' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                                                    hist.action === 'Status Alterado' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' :
                                                        'bg-slate-100 text-slate-500 border-slate-200'
                                                    }`}>
                                                    {hist.action}
                                                </span>
                                            </div>

                                            <div className={`max-w-[90%] rounded-[1.5rem] p-5 shadow-sm border ${isMe ? 'bg-white border-indigo-100' : 'bg-white border-slate-200'
                                                }`}>
                                                <p className="text-xs font-medium text-slate-700 leading-relaxed whitespace-pre-wrap">
                                                    {hist.message || '(Sem mensagem registrada)'}
                                                </p>

                                                {hist.attachments && hist.attachments.length > 0 && (
                                                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                        {hist.attachments.map((att, i) => (
                                                            <a
                                                                key={i}
                                                                href={att.url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-100 rounded-xl hover:border-indigo-200 hover:bg-indigo-50/50 transition-all group"
                                                            >
                                                                <div className="p-2 bg-white rounded-lg shadow-sm group-hover:bg-indigo-100">
                                                                    <Download className="w-3.5 h-3.5 text-indigo-500" />
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="text-[10px] font-black text-slate-800 truncate">{att.name}</p>
                                                                    {att.caption && <p className="text-[9px] text-slate-400 font-medium italic truncate">{att.caption}</p>}
                                                                </div>
                                                            </a>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* INPUT FOOTER */}
                        {canInteract ? (
                            <footer className="p-6 bg-white border-t border-slate-100">
                                <div className="flex items-end gap-3 bg-slate-50 border border-slate-200 rounded-[2rem] p-2 focus-within:ring-4 focus-within:ring-indigo-500/10 focus-within:border-indigo-500 transition-all">
                                    <button className="p-3.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-2xl transition-all">
                                        <Paperclip className="w-5 h-5" />
                                    </button>
                                    <textarea
                                        value={messageDraft}
                                        onChange={(e) => setMessageDraft(e.target.value)}
                                        placeholder="Digite uma nova atualização..."
                                        className="flex-1 bg-transparent resize-none max-h-40 min-h-[48px] py-4 px-1 text-sm font-medium outline-none text-slate-700 custom-scrollbar scrollbar-hide"
                                        rows={1}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                handleSendMessage();
                                            }
                                        }}
                                    />
                                    <button
                                        onClick={handleSendMessage}
                                        disabled={isSubmitting || !messageDraft.trim()}
                                        className="p-3.5 bg-slate-900 text-white rounded-2xl hover:bg-indigo-600 transition-all disabled:opacity-30 disabled:grayscale shadow-lg shadow-slate-900/10 active:scale-95"
                                    >
                                        <Send className="w-5 h-5" />
                                    </button>
                                </div>
                                <div className="flex items-center gap-2 mt-3 ml-4">
                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Ativo no Projeto</span>
                                </div>
                            </footer>
                        ) : (
                            <footer className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-center">
                                <div className="flex items-center gap-3 px-6 py-3 bg-white rounded-2xl border border-slate-200 shadow-sm text-slate-400">
                                    <Shield className="w-4 h-4" />
                                    <p className="text-[10px] font-black uppercase tracking-widest">Interação restrita ao responsável ou setor atual</p>
                                </div>
                            </footer>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
};
