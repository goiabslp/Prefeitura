import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar as CalendarIcon, Clock, CalendarDays, Check, MessageSquareX, AlertCircle, Loader2 } from 'lucide-react';
import { calendarService } from '../../services/calendarService';
import { googleCalendarService } from '../../services/googleCalendarService';

interface PendingInvitesModalProps {
    currentUserId: string;
    onClose: () => void; // Triggered when closed or all resolved
    onResolved: () => void; // Triggered specifically to refresh the calendar
}

export const PendingInvitesModal: React.FC<PendingInvitesModalProps> = ({ currentUserId, onClose, onResolved }) => {
    const [invites, setInvites] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isOpen, setIsOpen] = useState(false);

    // Decline State
    const [decliningInviteId, setDecliningInviteId] = useState<string | null>(null);
    const [declineReason, setDeclineReason] = useState('');
    const [submittingId, setSubmittingId] = useState<string | null>(null);

    useEffect(() => {
        const fetchInvites = async () => {
            setLoading(true);
            try {
                const pending = await calendarService.fetchPendingInvites(currentUserId);
                if (pending && pending.length > 0) {
                    setInvites(pending);
                    setIsOpen(true);
                }
            } catch (error) {
                console.error("Erro ao buscar convites pendentes", error);
            } finally {
                setLoading(false);
            }
        };
        fetchInvites();
    }, [currentUserId]);

    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const handleAccept = async (inviteId: string) => {
        setSubmittingId(inviteId);
        setErrorMessage(null);
        try {
            const targetInvite = invites.find(i => i.id === inviteId);
            const res = await calendarService.respondToInvite(inviteId, 'Aceito');
            if (res.success) {
                if (targetInvite?.calendar_events) {
                    await googleCalendarService.syncEventToGoogle(targetInvite.calendar_events);
                }
                removeInvite(inviteId);
            } else {
                setErrorMessage("Erro ao aceitar: " + res.error);
            }
        } catch (e) {
            console.error(e);
            setErrorMessage("Erro ao processar aceitação.");
        } finally {
            setSubmittingId(null);
        }
    };

    const handleDeclineRequest = (inviteId: string) => {
        setDecliningInviteId(inviteId);
        setDeclineReason('');
        setErrorMessage(null);
    };

    const confirmDecline = async () => {
        if (!decliningInviteId) return;
        setErrorMessage(null);
        if (!declineReason.trim()) {
            setErrorMessage("A justificativa é obrigatória.");
            return;
        }

        setSubmittingId(decliningInviteId);
        try {
            const res = await calendarService.respondToInvite(decliningInviteId, 'Recusado', declineReason);
            if (res.success) {
                removeInvite(decliningInviteId);
                setDecliningInviteId(null);
            } else {
                setErrorMessage("Erro ao recusar: " + res.error);
            }
        } catch (e) {
            console.error(e);
            setErrorMessage("Erro ao processar recusa.");
        } finally {
            setSubmittingId(null);
        }
    };

    const removeInvite = (id: string) => {
        setInvites(prev => {
            const next = prev.filter(inv => inv.id !== id);
            if (next.length === 0) {
                setIsOpen(false);
                onResolved();
                onClose();
            }
            return next;
        });
    };

    const closeAll = () => {
        setIsOpen(false);
        onClose();
        // Don't call onResolved if they just dismissed it, maybe they'll do it later.
    };

    if (!isOpen || loading) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[4000] flex items-center justify-center p-4 sm:p-6 pb-20 sm:pb-6">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
                />

                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 30 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 30 }}
                    className="relative w-full max-w-xl bg-white/90 backdrop-blur-xl border border-white/50 rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] flex flex-col max-h-[85vh] overflow-hidden"
                >
                    {/* Header */}
                    <div className="p-6 pb-4 flex items-center justify-between border-b border-slate-200/60 shrink-0">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center border border-indigo-200 shadow-inner">
                                <CalendarIcon className="w-6 h-6" />
                                <div className="absolute top-4 left-14 flex h-3 w-3">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span>
                                </div>
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-slate-800 tracking-tight">Convites Pendentes</h2>
                                <p className="text-sm font-medium text-slate-500">Você tem {invites.length} evento{invites.length > 1 ? 's' : ''} aguardando resposta.</p>
                            </div>
                        </div>

                        <button onClick={closeAll} className="p-2.5 bg-white/50 hover:bg-slate-100 rounded-xl text-slate-400 transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {errorMessage && (
                        <div className="mx-6 mt-3 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-bold flex items-center justify-between animate-fade-in">
                            <span>{errorMessage}</span>
                            <button onClick={() => setErrorMessage(null)} className="text-rose-500 hover:text-rose-700 font-black">✕</button>
                        </div>
                    )}

                    {/* Content List */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-4">
                        <AnimatePresence>
                            {invites.map((invite) => {
                                const event = invite.calendar_events;
                                const isDeclining = decliningInviteId === invite.id;
                                const isSubmitting = submittingId === invite.id;

                                const formatTime = (t: string) => t ? t.slice(0, 5) : '';
                                const formatDateBr = (d: string) => d.split('-').reverse().join('/');

                                return (
                                    <motion.div
                                        key={invite.id}
                                        layout
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.95, height: 0, marginBottom: 0 }}
                                        className="bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden relative"
                                    >
                                        <div className="p-5">
                                            <div className="flex justify-between items-start mb-3">
                                                <div>
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest bg-indigo-50 text-indigo-700 border border-indigo-100 mb-2 inline-block">
                                                        {event.type}
                                                    </span>
                                                    <h3 className="text-lg font-bold text-slate-800 leading-tight">
                                                        {event.title}
                                                    </h3>
                                                </div>
                                                <div className="text-right">
                                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Seu Papel</span>
                                                    <span className="text-sm font-semibold text-indigo-600">{invite.role === 'Colaborador' ? 'Organizador' : 'Participante'}</span>
                                                </div>
                                            </div>

                                            <div className="flex flex-col gap-2 mb-4 bg-slate-50 p-3 rounded-xl border border-slate-100">
                                                <div className="flex items-center gap-2 text-sm text-slate-600 font-medium">
                                                    <CalendarDays className="w-4 h-4 text-slate-400" />
                                                    {event.start_date === event.end_date
                                                        ? formatDateBr(event.start_date)
                                                        : `De ${formatDateBr(event.start_date)} a ${formatDateBr(event.end_date)}`}
                                                </div>
                                                <div className="flex items-center gap-2 text-sm text-slate-600 font-medium">
                                                    <Clock className="w-4 h-4 text-slate-400" />
                                                    {event.is_all_day ? 'Dia Inteiro' : `${formatTime(event.start_time)} às ${formatTime(event.end_time)}`}
                                                </div>
                                            </div>

                                            {/* Action Buttons */}
                                            {!isDeclining ? (
                                                <div className="flex gap-3">
                                                    <button
                                                        onClick={() => handleAccept(invite.id)}
                                                        disabled={isSubmitting}
                                                        className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-xl transition-colors border border-emerald-200"
                                                    >
                                                        {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                                        Aceitar
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeclineRequest(invite.id)}
                                                        disabled={isSubmitting}
                                                        className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl transition-colors border border-rose-200"
                                                    >
                                                        <MessageSquareX className="w-4 h-4" />
                                                        Recusar
                                                    </button>
                                                </div>
                                            ) : (
                                                <motion.div
                                                    initial={{ opacity: 0, height: 0 }}
                                                    animate={{ opacity: 1, height: 'auto' }}
                                                    className="flex flex-col gap-3"
                                                >
                                                    <div className="flex items-center gap-2 text-sm font-bold text-rose-700">
                                                        <AlertCircle className="w-4 h-4" />
                                                        Justificativa Obrigatória
                                                    </div>
                                                    <textarea
                                                        autoFocus
                                                        value={declineReason}
                                                        onChange={e => setDeclineReason(e.target.value)}
                                                        placeholder="Por que você não poderá participar?"
                                                        className="w-full p-3 rounded-xl border border-rose-200 bg-rose-50/30 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/30 focus:bg-white resize-none"
                                                        rows={2}
                                                    />
                                                    <div className="flex gap-3 mt-1">
                                                        <button
                                                            onClick={() => setDecliningInviteId(null)}
                                                            disabled={isSubmitting}
                                                            className="flex-1 py-2 text-slate-500 hover:bg-slate-100 rounded-xl font-bold text-sm transition-colors"
                                                        >
                                                            Cancelar
                                                        </button>
                                                        <button
                                                            onClick={confirmDecline}
                                                            disabled={isSubmitting || !declineReason.trim()}
                                                            className="flex-1 flex items-center justify-center gap-2 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl transition-colors disabled:opacity-50"
                                                        >
                                                            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar Recusa'}
                                                        </button>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </AnimatePresence>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};
