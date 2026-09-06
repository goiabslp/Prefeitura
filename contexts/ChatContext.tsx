import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '../services/supabaseClient';
import { useAuth } from './AuthContext';
import { ChatMessage } from '../services/chatService';

interface ChatContextType {
    activeChat: { type: 'user' | 'sector', id: string, name: string } | null;
    setActiveChat: (chat: { type: 'user' | 'sector', id: string, name: string } | null) => void;
    messages: ChatMessage[];
    sendMessage: (content: string, fileData?: { url: string, name: string, type: string }) => Promise<void>;
    uploadAttachment: (file: File) => Promise<{ url: string, name: string, type: string }>;
    unreadCount: number;
    refreshUnreadCount: () => Promise<void>;
    isOpen: boolean;
    setIsOpen: (open: boolean) => void;
    onlineUsers: Set<string>;
    lastUpdate: number;
    latestIncomingMessage: ChatMessage | null;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const useChat = () => {
    const context = useContext(ChatContext);
    if (!context) throw new Error('useChat must be used within a ChatProvider');
    return context;
};

export const ChatProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
    const [lastUpdate] = useState(Date.now());

    // Presença de usuários online no sistema (usado pelo OnlineUsers no cabeçalho)
    useEffect(() => {
        if (!user) return;

        const presenceChannel = supabase.channel('online_users_presence', {
            config: {
                presence: {
                    key: user.id,
                },
            },
        });

        presenceChannel
            .on('presence', { event: 'sync' }, () => {
                const newState = presenceChannel.presenceState();
                const userIds = Object.keys(newState);
                setOnlineUsers(new Set(userIds));
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    await presenceChannel.track({
                        online_at: new Date().toISOString(),
                    });
                }
            });

        return () => {
            presenceChannel.unsubscribe();
        };
    }, [user]);

    const refreshUnreadCount = async () => {};
    const sendMessage = async () => {};
    const uploadAttachment = async () => ({ url: '', name: '', type: '' });

    return (
        <ChatContext.Provider value={{
            activeChat: null,
            setActiveChat: () => {},
            messages: [],
            sendMessage,
            uploadAttachment,
            unreadCount: 0,
            refreshUnreadCount,
            isOpen,
            setIsOpen,
            onlineUsers,
            lastUpdate,
            latestIncomingMessage: null
        }}>
            {children}
        </ChatContext.Provider>
    );
};
