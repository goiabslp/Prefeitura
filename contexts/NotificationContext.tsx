import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { ToastType as BaseToastType } from '../components/common/ToastNotification';
import { notificationService } from '../services/notificationService';
import { useAuth } from './AuthContext';
import { supabase } from '../services/supabaseClient';

// Extend the external ToastType locally
export type ToastType = BaseToastType | 'login';



export interface Notification {
    id: string;
    title: string;
    message: string;
    type: ToastType;
    read: boolean;
    createdAt: Date;
    link?: string; // Optional link to navigate to
    isUiOnly?: boolean;
}

interface NotificationContextType {
    notifications: Notification[];
    unreadCount: number;
    addNotification: (title: string, message: string, type?: ToastType, link?: string) => void;
    markAsRead: (id: string) => void;
    markAllAsRead: () => void;
    removeNotification: (id: string) => void;
    clearAll: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotification = () => {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error('useNotification must be used within a NotificationProvider');
    }
    return context;
};

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const { user } = useAuth(); // Assuming useAuth exists and provides current user

    // Load from DB on mount
    useEffect(() => {
        if (!user) {
            setNotifications([]);
            return;
        }

        const loadNotifications = async () => {
            const data = await notificationService.fetchNotifications(user.id);
            // Transform DB notification to Context Notification (date handling)
            const mapped = data.map(n => ({
                ...n,
                createdAt: new Date(n.created_at)
            }));
            setNotifications(mapped);
        };

        loadNotifications();
    }, [user]);

    // Real-time Notifications Listener (DB Table)
    useEffect(() => {
        if (!user) return;

        const channel = supabase.channel(`notifications:${user.id}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${user.id}`
                },
                (payload) => {
                    const newNotif = payload.new;
                    setNotifications(prev => {
                        // Avoid duplicates if we already have it (e.g. from refetch or optimistic)
                        if (prev.some(n => n.id === newNotif.id)) return prev;

                        const mapped: Notification = {
                            id: newNotif.id,
                            title: newNotif.title,
                            message: newNotif.message,
                            type: newNotif.type as ToastType,
                            read: newNotif.read,
                            createdAt: new Date(newNotif.created_at),
                            link: newNotif.link
                        };
                        return [mapped, ...prev];
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user]);




    const addNotification = useCallback((title: string, message: string, type: ToastType = 'info', link?: string) => {
        const tempId = Math.random().toString(36).substr(2, 9);
        const newNotification: Notification = {
            id: tempId,
            title,
            message,
            type,
            read: false,
            createdAt: new Date(),
            link,
            isUiOnly: true
        };
        setNotifications(prev => [newNotification, ...prev]);
    }, []);

    // Real-time Login Listener
    useEffect(() => {
        const channel = supabase.channel('global_events')
            .on('broadcast', { event: 'user-login' }, (payload) => {
                // Ensure payload has data
                if (payload.payload && payload.payload.username) {
                    // We don't want to notify about our own login (optional)
                    // But if we want to see it for verification, let's keep it or filter by comparing username.
                    // Usually "Logged IN" is for OTHERS to see.
                    if (user && payload.payload.username === user.name) return;

                    addNotification(
                        'Novo Acesso',
                        `${payload.payload.username} acabou de entrar no sistema.`,
                        'login' as any // We will add 'login' to ToastType or handle as 'info' with special logic
                    );
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user, addNotification]);

    const markAsRead = useCallback(async (id: string) => {
        // Optimistic
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
        // DB
        await notificationService.markAsRead(id);
    }, []);

    const markAllAsRead = useCallback(async () => {
        if (!user) return;
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        await notificationService.markAllAsRead(user.id);
    }, [user]);

    const removeNotification = useCallback(async (id: string) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
        await notificationService.removeNotification(id);
    }, []);

    const clearAll = useCallback(async () => {
        if (!user) return;
        setNotifications([]);
        await notificationService.clearAll(user.id);
    }, [user]);

    const unreadCount = notifications.filter(n => !n.read && !n.isUiOnly).length;

    return (
        <NotificationContext.Provider value={{
            notifications,
            unreadCount,
            addNotification,
            markAsRead,
            markAllAsRead,
            removeNotification,
            clearAll
        }}>
            {children}
        </NotificationContext.Provider>
    );
};
