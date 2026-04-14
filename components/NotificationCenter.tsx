import React, { useRef, useEffect } from 'react';
import { useNotification } from '../contexts/NotificationContext';
import { Bell, Check, Trash2, X, MessageSquare, AlertCircle, Info, CheckCircle2 } from 'lucide-react';

interface NotificationCenterProps {
    isOpen: boolean;
    onClose: () => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ isOpen, onClose }) => {
    const { notifications, markAsRead, markAllAsRead, removeNotification, clearAll } = useNotification();
    const displayNotifications = notifications.filter(n => !n.read && !n.isUiOnly);

    const centerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (centerRef.current && !centerRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const getIcon = (type: string) => {
        switch (type) {
            case 'success': return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
            case 'error': return <AlertCircle className="w-5 h-5 text-rose-500" />;
            case 'warning': return <AlertCircle className="w-5 h-5 text-amber-500" />;
            default: return <Info className="w-5 h-5 text-blue-500" />;
        }
    };

    return (
        <div
            ref={centerRef}
            className="fixed top-16 right-4 sm:right-6 md:right-10 w-[90vw] sm:w-[400px] bg-white/90 backdrop-blur-2xl rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.2)] border border-white/50 ring-1 ring-slate-100 z-[70] flex flex-col max-h-[80vh] animate-slide-up-sm origin-top-right overflow-hidden"
        >
            {/* Header */}
            <div className="p-5 border-b border-slate-100/50 bg-white/50 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600">
                        <Bell className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800 text-lg leading-tight">Notificações</h3>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                            {displayNotifications.length} não lidas
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-1">
                    {displayNotifications.length > 0 && (
                        <button
                            onClick={markAllAsRead}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Marcar todas como lidas"
                        >
                            <Check className="w-4 h-4" />
                        </button>
                    )}
                    {displayNotifications.length > 0 && (
                        <button
                            onClick={clearAll}
                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Limpar tudo"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    )}
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                {displayNotifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center opacity-50">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4 text-slate-300">
                            <Bell className="w-8 h-8" />
                        </div>
                        <p className="text-slate-500 font-medium">Nenhuma notificação</p>
                        <p className="text-xs text-slate-400 max-w-[200px] mt-1">Você está em dia com todas as suas atualizações.</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-2">
                        {displayNotifications.map((notification) => (
                            <div
                                key={notification.id}
                                className={`relative group p-4 rounded-2xl border transition-all duration-200 flex gap-4
                  ${notification.read
                                        ? 'bg-white/40 border-slate-100 hover:bg-white hover:border-slate-200'
                                        : 'bg-indigo-50/40 border-indigo-100 hover:bg-indigo-50/60'
                                    }`}
                            >
                                {!notification.read && (
                                    <div className="absolute top-4 right-4 w-2 h-2 bg-indigo-500 rounded-full animate-pulse shadow-lg shadow-indigo-500/50"></div>
                                )}

                                <div className={`shrink-0 mt-0.5 p-2 rounded-xl h-fit ${notification.type === 'success' ? 'bg-emerald-100 text-emerald-600' :
                                    notification.type === 'error' ? 'bg-rose-100 text-rose-600' :
                                        notification.type === 'warning' ? 'bg-amber-100 text-amber-600' :
                                            'bg-blue-100 text-blue-600'
                                    }`}>
                                    {getIcon(notification.type)}
                                </div>

                                <div className="flex-1 min-w-0 pr-6">
                                    <h4 className={`text-sm font-bold mb-0.5 truncate ${notification.read ? 'text-slate-700' : 'text-slate-900'}`}>
                                        {notification.title}
                                    </h4>
                                    <p className="text-xs text-slate-500 leading-relaxed line-clamp-2 mb-2">
                                        {notification.message}
                                    </p>
                                    <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">
                                        {new Date(notification.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>

                                {/* Hover Actions */}
                                <div className="absolute bottom-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {!notification.read && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); markAsRead(notification.id); }}
                                            className="p-1.5 bg-white border border-slate-100 rounded-lg text-slate-400 hover:text-indigo-600 hover:border-indigo-100 shadow-sm"
                                            title="Marcar como lida"
                                        >
                                            <Check className="w-3 h-3" />
                                        </button>
                                    )}
                                    <button
                                        onClick={(e) => { e.stopPropagation(); removeNotification(notification.id); }}
                                        className="p-1.5 bg-white border border-slate-100 rounded-lg text-slate-400 hover:text-rose-600 hover:border-rose-100 shadow-sm"
                                        title="Remover"
                                    >
                                        <Trash2 className="w-3 h-3" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-slate-100 bg-slate-50/50 text-center">
                <button className="text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:underline">
                    Ver Todo o Histórico
                </button>
            </div>
        </div>
    );
};
