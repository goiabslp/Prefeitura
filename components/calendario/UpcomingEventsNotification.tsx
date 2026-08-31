import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Calendar as CalendarIcon, X, Clock } from 'lucide-react';
import { calendarService, CalendarEvent } from '../../services/calendarService';
import { supabase } from '../../services/supabaseClient';
import { getLocalISOData } from '../../utils/dateUtils';

const STORAGE_KEY = 'prefeitura_eventos_lembretes_v2';

export const UpcomingEventsNotification: React.FC = () => {
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [isVisible, setIsVisible] = useState(false);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);

    useEffect(() => {
        const init = async () => {
            const { data } = await supabase.auth.getUser();
            if (data.user) setCurrentUserId(data.user.id);
        };
        init();
    }, []);

    useEffect(() => {
        if (!currentUserId) return;

        const checkUpcomingEvents = async () => {
            try {
                // Obter lista de lembretes que já foram exibidos ao usuário
                let notifiedIds: string[] = [];
                try {
                    const raw = localStorage.getItem(STORAGE_KEY);
                    if (raw) notifiedIds = JSON.parse(raw);
                } catch (e) {
                    notifiedIds = [];
                }

                const today = new Date();
                const todayStr = getLocalISOData(today).date;

                // Data de amanhã (Exatamente 1 dia antes do evento: D-1)
                const tomorrow = new Date(today);
                tomorrow.setDate(tomorrow.getDate() + 1);
                const tomorrowStr = getLocalISOData(tomorrow).date;

                // Busca eventos de hoje até 2 dias à frente
                const future = new Date(today);
                future.setDate(future.getDate() + 2);
                const endDateStr = getLocalISOData(future).date;

                const allEvents = await calendarService.fetchEvents(todayStr, endDateStr);

                const nowTime = Date.now();
                const upcomingToNotify: CalendarEvent[] = [];
                const newNotifiedKeys: string[] = [...notifiedIds];

                for (const evt of allEvents) {
                    // Verifica permissão/vínculo do usuário no evento
                    const isOwner = evt.created_by === currentUserId;
                    const isAcceptedInvite = evt.invites?.some(i => i.user_id === currentUserId && i.status === 'Aceito');
                    if (!isOwner && !isAcceptedInvite) continue;

                    const eventCreatedAt = evt.created_at ? new Date(evt.created_at).getTime() : 0;
                    const isJustCreated = eventCreatedAt > 0 && (nowTime - eventCreatedAt) < (2 * 60 * 1000); // Criado nos últimos 2 min
                    const keyCreated = `${evt.id}_created`;
                    const keyD1 = `${evt.id}_d1`;

                    // Caso 1: Evento foi recém-criado (mostra apenas 1 vez na criação)
                    if (isJustCreated && !newNotifiedKeys.includes(keyCreated)) {
                        upcomingToNotify.push(evt);
                        newNotifiedKeys.push(keyCreated);
                    }
                    // Caso 2: Exatamente 1 dia antes do evento (D-1, mostra apenas 1 única vez)
                    else if (evt.start_date === tomorrowStr && !newNotifiedKeys.includes(keyD1)) {
                        upcomingToNotify.push(evt);
                        newNotifiedKeys.push(keyD1);
                    }
                }

                if (upcomingToNotify.length > 0) {
                    setEvents(upcomingToNotify);
                    setIsVisible(true);

                    // Salva que esses lembretes já foram disparados para não repetir
                    try {
                        localStorage.setItem(STORAGE_KEY, JSON.stringify(newNotifiedKeys));
                    } catch (e) {}

                    // Auto-dispensar visualmente após 8 segundos
                    setTimeout(() => {
                        setIsVisible(false);
                    }, 8000);
                }
            } catch (err) {
                console.error("Erro ao buscar lembretes de eventos", err);
            }
        };

        checkUpcomingEvents();
    }, [currentUserId]);

    const handleDismiss = (id: string) => {
        setEvents(prev => {
            const next = prev.filter(p => p.id !== id);
            if (next.length === 0) setIsVisible(false);
            return next;
        });
    };

    if (!isVisible || events.length === 0) return null;

    return (
        <div className="fixed top-20 right-6 z-[2000] flex flex-col gap-3 max-w-sm w-full pointer-events-none">
            <AnimatePresence>
                {events.map((evt, idx) => (
                    <motion.div
                        key={`${evt.id}-${idx}`}
                        initial={{ opacity: 0, y: -20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -20, scale: 0.95 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300, delay: idx * 0.1 }}
                        className="bg-white/95 backdrop-blur-md shadow-2xl rounded-2xl border border-indigo-100 overflow-hidden shrink-0 pointer-events-auto group"
                    >
                        <div className="flex bg-gradient-to-r from-indigo-50/80 via-white to-white p-4 items-start gap-3.5">
                            <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0 shadow-xs border border-indigo-200">
                                <Bell className="w-4 h-4" />
                            </div>

                            <div className="flex-1 min-w-0 pr-2">
                                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 mb-0.5 block">
                                    Lembrete de Evento • 1 dia antes
                                </span>
                                <h4 className="text-xs sm:text-sm font-bold text-slate-800 truncate">
                                    {evt.title}
                                </h4>
                                <div className="flex items-center gap-3 mt-1 text-[11px] font-semibold text-slate-500">
                                    <span className="flex items-center gap-1">
                                        <CalendarIcon className="w-3 h-3 text-indigo-500" />
                                        {evt.start_date.split('-').reverse().join('/')}
                                    </span>
                                    {!evt.is_all_day && evt.start_time && (
                                        <span className="flex items-center gap-1">
                                            <Clock className="w-3 h-3 text-slate-400" />
                                            {evt.start_time.slice(0, 5)}
                                        </span>
                                    )}
                                </div>
                            </div>

                            <button
                                onClick={() => handleDismiss(evt.id)}
                                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors shrink-0 cursor-pointer"
                                title="Fechar lembrete"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                        {/* Barra visual de tempo */}
                        <div className="h-1 w-full bg-slate-100 overflow-hidden">
                            <motion.div
                                initial={{ width: "100%" }}
                                animate={{ width: "0%" }}
                                transition={{ duration: 8, ease: "linear" }}
                                className="h-full bg-indigo-600 rounded-r-full"
                            />
                        </div>
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
};
