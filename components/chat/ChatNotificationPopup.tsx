import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useChat } from '../../contexts/ChatContext';
import { ChatMessage } from '../../services/chatService';
import { X, MessageSquare, User } from 'lucide-react';

interface QueuedMessage extends ChatMessage {
    notificationId: string;
}

export const ChatNotificationPopup: React.FC = () => {
    const { latestIncomingMessage, setActiveChat, setIsOpen, isOpen, activeChat } = useChat();
    const [activeToast, setActiveToast] = useState<QueuedMessage | null>(null);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (latestIncomingMessage) {
            // Already showing this message? Ignore duplicate triggers if they happen (useEffect safe-guard)
            if (activeToast?.id === latestIncomingMessage.id) return;

            // If we are currently chatting with this user/sector AND the window is open, don't show notification
            // (Double check logic, although Context shouldn't have set latestIncomingMessage in this case)
            if (isOpen && activeChat) {
                if (latestIncomingMessage.sector_id && latestIncomingMessage.sector_id === activeChat.id) return;
                if (latestIncomingMessage.sender_id === activeChat.id) return;
            }

            const newToast: QueuedMessage = {
                ...latestIncomingMessage,
                notificationId: Math.random().toString(36).substr(2, 9)
            };

            // Queue logic: Simply replace the current one to show the newest. 
            // Or ideally, we could stack them, but requested is "Um pop-up", potentially implying singular focus or singular stack.
            // Let's Replace for now to ensure "latest" is seen.
            setActiveToast(newToast);

            // Auto dismiss
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            timeoutRef.current = setTimeout(() => {
                setActiveToast(null);
            }, 6000); // 6 seconds visible
        }
    }, [latestIncomingMessage]);

    // Cleanup timeout
    useEffect(() => {
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, []);

    if (!activeToast) return null;

    const handleOpenChat = () => {
        // Determine type and ID
        // If sector_id exists and not global broadcast (wait, broadcast logic?)
        // Assuming normal flow:
        if (activeToast.sector_id && !activeToast.receiver_id) {
            // Sector message
            // If it's "global", handle special case or normal sector
            setActiveChat({ type: 'sector', id: activeToast.sector_id, name: 'Setor' }); // Name might be generic if not in message
        } else {
            // Direct message or Global User Broadcast (sender is user)
            setActiveChat({ type: 'user', id: activeToast.sender_id, name: activeToast.sender?.name || 'Usuário' });
        }

        setIsOpen(true);
        setActiveToast(null);
    };

    const handleDismiss = (e: React.MouseEvent) => {
        e.stopPropagation();
        setActiveToast(null);
    };

    const formatTime = (isoString: string) => {
        return new Date(isoString).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    };

    // Safely truncate message
    const truncate = (str: string, n: number) => {
        return (str.length > n) ? str.substr(0, n - 1) + '...' : str;
    };

    return createPortal(
        <div className="fixed top-0 left-0 right-0 z-[110] flex justify-center pointer-events-none p-4 pt-6">
            <div
                className="pointer-events-auto max-w-sm w-full bg-white/90 backdrop-blur-md shadow-2xl rounded-2xl border border-white/20 ring-1 ring-black/5 overflow-hidden animate-slide-in-top cursor-pointer group hover:bg-white transform transition-all duration-300"
                onClick={handleOpenChat}
            >
                <div className="p-4 flex gap-4 items-start relative overflow-hidden">
                    {/* Decorative Background Blur */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />

                    {/* Inicial ou Ícone do Remetente */}
                    <div className="relative shrink-0">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-indigo-500/20">
                            {activeToast.sender?.name ? activeToast.sender.name.charAt(0).toUpperCase() : <User className="w-6 h-6" />}
                        </div>
                        <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-white">
                            <span className="h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse"></span>
                        </span>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 z-10">
                        <div className="flex items-center gap-2 mb-0.5 mt-1 pr-6">
                            <h4 className="font-bold text-slate-800 text-sm truncate">
                                {activeToast.sender?.name || 'Desconhecido'}
                            </h4>
                            <span className="text-[10px] font-medium text-slate-400 shrink-0">
                                {formatTime(activeToast.created_at)}
                            </span>
                        </div>

                        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">

                            {activeToast.sector_id && activeToast.sector_id !== 'global' && (
                                <span className="bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded text-[10px]">
                                    Setor
                                </span>
                            )}
                        </div>

                        <p className="text-sm text-slate-600 mt-1.5 line-clamp-2 leading-snug">
                            {activeToast.message || (activeToast.file_url ? '📎 Enviou um anexo' : '')}
                        </p>
                    </div>

                    {/* Dismiss Button */}
                    <button
                        onClick={handleDismiss}
                        className="absolute top-2 right-2 p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors z-20 opacity-0 group-hover:opacity-100"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Progress Bar (Visual indication of timeout) */}
                <div className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-indigo-500 to-purple-500 animate-progress-bar w-full origin-left" />
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes slide-in-top {
                    0% { transform: translateY(-100%) scale(0.9); opacity: 0; }
                    100% { transform: translateY(0) scale(1); opacity: 1; }
                }
                .animate-slide-in-top {
                    animation: slide-in-top 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }
                @keyframes progress-bar {
                    0% { transform: scaleX(1); }
                    100% { transform: scaleX(0); }
                }
                .animate-progress-bar {
                    animation: progress-bar 6s linear forwards;
                }
            `}} />
        </div>,
        document.body
    );
};
