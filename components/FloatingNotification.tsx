import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNotification } from '../contexts/NotificationContext';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export const FloatingNotification: React.FC = () => {
    const { notifications } = useNotification();
    const [activeToasts, setActiveToasts] = useState<typeof notifications>([]);

    // Logic to show only the MOST RECENT unread notifications relative to "now"
    // Since we don't have a "seen" state for toasts specifically, we can track by ID in local state
    // Or simply show the last added notification if it's new.

    // Approach: Watch notifications array. If a new one appears that is NOT in activeToasts, add it.
    // Then automatically remove it after X seconds.

    useEffect(() => {
        // Check for new notifications at the TOP of the list
        if (notifications.length > 0) {
            const latest = notifications[0];
            // If it was created very recently (e.g. last 2 seconds) and we aren't showing it yet
            // This prevents showing old notifications on page reload
            const isRecent = (new Date().getTime() - new Date(latest.createdAt).getTime()) < 2000;

            if (isRecent) {
                setActiveToasts(prev => {
                    if (prev.find(n => n.id === latest.id)) return prev;
                    
                    // Prevent duplicate active toasts for the same event
                    if (latest.type === 'login' && prev.some(n => n.type === 'login' && n.message === latest.message)) {
                        return prev;
                    }

                    return [...prev, latest];
                });

                // Auto remove after duration
                setTimeout(() => {
                    setActiveToasts(prev => prev.filter(n => n.id !== latest.id));
                }, 5000);
            }
        }
    }, [notifications]);

    if (activeToasts.length === 0) return null;

    return createPortal(
        <div className="fixed top-0 left-0 right-0 z-[100] flex flex-col items-center pointer-events-none p-6 gap-2">
            {activeToasts.map((toast, index) => (
                <div
                    key={toast.id}
                    className={`
            pointer-events-auto flex items-center gap-4 px-5 py-4 rounded-2xl border shadow-2xl backdrop-blur-2xl transition-all duration-500 ease-out transform animate-slide-down
            ${toast.type === 'success' ? 'bg-emerald-500/90 border-emerald-400/50 text-white shadow-emerald-500/30' :
                            toast.type === 'error' ? 'bg-rose-500/90 border-rose-400/50 text-white shadow-rose-500/30' :
                                toast.type === 'warning' ? 'bg-amber-500/90 border-amber-400/50 text-white shadow-amber-500/30' :
                                    toast.type === 'login' ? 'bg-violet-600/90 border-violet-400/50 text-white shadow-violet-500/40' :
                                        'bg-indigo-500/90 border-indigo-400/50 text-white shadow-indigo-500/30'
                        }
          `}
                >
                    <div className="p-1 rounded-full bg-white/20">
                        {toast.type === 'success' && <CheckCircle2 className="w-5 h-5" />}
                        {toast.type === 'error' && <AlertCircle className="w-5 h-5" />}
                        {toast.type === 'warning' && <AlertCircle className="w-5 h-5" />}
                        {toast.type === 'info' && <Info className="w-5 h-5" />}
                        {toast.type === 'login' && (
                            <div className="relative">
                                {/* Simulated User Avatar for Dynamic feel */}
                                <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-pink-400 to-purple-400 flex items-center justify-center text-[10px] font-bold uppercase ring-2 ring-white/30">
                                    {toast.title.charAt(0)}
                                </div>
                                <span className="absolute -bottom-1 -right-1 flex h-2.5 w-2.5">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                                </span>
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col">
                        <h4 className="font-bold text-sm leading-none mb-1">{toast.title}</h4>
                        <p className="text-xs font-medium opacity-90">{toast.message}</p>
                    </div>

                    <button
                        onClick={() => setActiveToasts(prev => prev.filter(n => n.id !== toast.id))}
                        className="ml-2 p-1 rounded-lg hover:bg-white/20 transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            ))}
        </div>,
        document.body
    );
};
