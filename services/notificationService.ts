import { supabase } from './supabaseClient';
import { ToastType } from '../components/common/ToastNotification';

export interface Notification {
    id: string;
    user_id: string;
    title: string;
    message: string;
    type: ToastType;
    read: boolean;
    created_at: string;
    link?: string;
}

export const notificationService = {
    async fetchNotifications(userId: string): Promise<Notification[]> {
        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(50); // increased limit

        if (error) {
            console.error('Error fetching notifications:', error);
            return [];
        }
        return data as Notification[];
    },

    async requestBrowserPermission(): Promise<boolean> {
        if (typeof window !== 'undefined' && 'Notification' in window) {
            try {
                const permission = await Notification.requestPermission();
                return permission === 'granted';
            } catch (e) {
                console.warn('Erro ao solicitar permissão de notificação:', e);
            }
        }
        return false;
    },

    showNativeNotification(title: string, message: string, link?: string): void {
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            try {
                const n = new Notification(title, {
                    body: message,
                    icon: '/pwa-192x192.png',
                    badge: '/pwa-192x192.png',
                    tag: title
                });
                if (link) {
                    n.onclick = () => {
                        window.focus();
                        window.history.pushState({}, '', link);
                        window.dispatchEvent(new Event('popstate'));
                        n.close();
                    };
                }
            } catch (err) {
                console.warn('Alerta notificação nativa:', err);
            }
        }
    },

    async createNotification(notification: Omit<Notification, 'id' | 'created_at' | 'read'>): Promise<void> {
        const { error } = await supabase
            .from('notifications')
            .insert([{ ...notification, read: false }]);

        if (error) {
            console.error('Error creating notification:', error);
        }

        this.showNativeNotification(notification.title, notification.message, notification.link);
    },

    async markAsRead(id: string): Promise<void> {
        const { error } = await supabase
            .from('notifications')
            .update({ read: true })
            .eq('id', id);

        if (error) {
            console.error('Error marking notification as read:', error);
        }
    },

    async markAllAsRead(userId: string): Promise<void> {
        const { error } = await supabase
            .from('notifications')
            .update({ read: true })
            .eq('user_id', userId)
            .eq('read', false);

        if (error) {
            console.error('Error marking all as read:', error);
        }
    },

    async removeNotification(id: string): Promise<void> {
        const { error } = await supabase
            .from('notifications')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error removing notification:', error);
        }
    },

    async clearAll(userId: string): Promise<void> {
        // Option 1: Delete all
        // const { error } = await supabase.from('notifications').delete().eq('user_id', userId);

        // Option 2: Mark all as read (if "Clear" just means "Dismiss visually" but keep history? Usually Clear means delete for UI)
        // Let's implement Delete for Clear All
        const { error } = await supabase
            .from('notifications')
            .delete()
            .eq('user_id', userId);

        if (error) {
            console.error('Error clearing notifications:', error);
        }
    }
};
