import { supabase } from './supabaseClient';

export interface ChatMessage {
    id: string;
    sender_id: string;
    receiver_id?: string;
    sector_id?: string;
    message: string;
    read: boolean;
    created_at: string;
    file_url?: string;
    file_name?: string;
    file_type?: string;
    sender?: {
        name: string;
        username: string;
    };
}

export interface RecentConversation {
    id: string;
    type: 'user' | 'sector';
    lastMessage: string;
    unreadCount: number;
    timestamp: string;
    originalRef?: ChatMessage;
}

export const chatService = {
    async sendMessage(message: Omit<ChatMessage, 'id' | 'created_at' | 'read' | 'sender'>) {
        const { data, error } = await supabase
            .from('chat_messages')
            .insert(message)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async uploadAttachment(file: File) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random()}-${Date.now()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { data, error } = await supabase.storage
            .from('chat-attachments')
            .upload(filePath, file);

        if (error) throw error;

        const { data: { publicUrl } } = supabase.storage
            .from('chat-attachments')
            .getPublicUrl(filePath);

        return {
            url: publicUrl,
            name: file.name,
            type: file.type
        };
    },

    async fetchDirectMessages(currentUserId: string, otherUserId: string) {
        // Check clearance
        const { data: clearance } = await supabase
            .from('chat_cleared_history')
            .select('cleared_at')
            .eq('user_id', currentUserId)
            .eq('target_id', otherUserId)
            .eq('target_type', 'user')
            .single();

        const CHAT_COLUMNS = 'id, sender_id, receiver_id, sector_id, message, read, created_at, file_url, file_name, file_type, sender:profiles(name, username)';
        let query = supabase
            .from('chat_messages')
            .select(CHAT_COLUMNS);

        if (otherUserId === 'global-users') {
            // Global users Mural: both receiver and sector are null
            query = query.filter('receiver_id', 'is', null).filter('sector_id', 'is', null);
        } else {
            // Direct message between two users
            const u1 = currentUserId.toLowerCase();
            const u2 = otherUserId.toLowerCase();
            // Use safer string construction
            query = query.or(`and(sender_id.eq.${u1},receiver_id.eq.${u2}),and(sender_id.eq.${u2},receiver_id.eq.${u1})`);
        }

        if (clearance?.cleared_at) {
            query = query.gt('created_at', clearance.cleared_at);
        }

        const { data, error } = await query.order('created_at', { ascending: true });

        if (error) {
            console.error('Error in fetchDirectMessages:', error);
            throw error;
        }

        console.log(`[ChatService] Fetched ${data?.length} messages between ${currentUserId} and ${otherUserId}`);
        return (data || []) as unknown as ChatMessage[];
    },

    async fetchSectorMessages(sectorId: string, currentUserId?: string) {
        // Check clearance for sector if currentUserId provided
        let clearedAtStr = null;
        if (currentUserId) {
            const { data: clearance } = await supabase
                .from('chat_cleared_history')
                .select('cleared_at')
                .eq('user_id', currentUserId)
                .eq('target_id', sectorId)
                .eq('target_type', 'sector')
                .single();
            clearedAtStr = clearance?.cleared_at;
        }

        const CHAT_COLUMNS = 'id, sender_id, receiver_id, sector_id, message, read, created_at, file_url, file_name, file_type, sender:profiles(name, username)';
        let query = supabase
            .from('chat_messages')
            .select(CHAT_COLUMNS)
            .eq('sector_id', sectorId);

        if (clearedAtStr) {
            query = query.gt('created_at', clearedAtStr);
        }

        const { data, error } = await query.order('created_at', { ascending: true });

        if (error) throw error;
        return (data || []) as unknown as ChatMessage[];
    },

    async markAsRead(targetIds: string[], type: 'user' | 'sector' = 'user', currentUserId?: string, targetId?: string) {
        if (targetIds.length === 0 && !targetId) return;

        // Legacy: Mark specific messages as read (Works for DMs where we know the IDs)
        if (type === 'user' && targetIds.length > 0) {
            const { error } = await supabase
                .from('chat_messages')
                .update({ read: true })
                .in('id', targetIds);
            if (error) throw error;
        }

        // New Logic: Update Last Read Timestamp (For Sector and User consistency)
        if (currentUserId && targetId) {
            const { error } = await supabase
                .from('chat_last_read')
                .upsert({
                    user_id: currentUserId,
                    target_id: targetId,
                    target_type: type,
                    last_read_at: new Date().toISOString()
                }, { onConflict: 'user_id, target_id, target_type' });

            if (error) console.error('Error updating last_read:', error);
        }
    },

    async fetchUnreadCount(userId: string, userSectorId?: string) {
        // 1. Direct Messages Unread (Legacy 'read' flag)
        // Count messages sent to ME where read is false.
        const { count: dmCount, error: dmError } = await supabase
            .from('chat_messages')
            .select('id', { count: 'exact', head: true })
            .eq('read', false)
            .eq('receiver_id', userId);

        if (dmError) {
            console.error('Error fetching DM unread count', dmError);
            // Non-fatal, continue to sector
        }

        // 2. Sector Messages Unread (Time-based)
        let sectorCount = 0;
        if (userSectorId) {
            // Get last read time for my sector
            const { data: lastRead } = await supabase
                .from('chat_last_read')
                .select('last_read_at')
                .eq('user_id', userId)
                .eq('target_id', userSectorId)
                .eq('target_type', 'sector')
                .single();

            const lastReadAt = lastRead?.last_read_at || '1970-01-01T00:00:00Z';

            // Count messages in my sector NEWER than lastReadAt AND NOT sent by me
            const { count, error } = await supabase
                .from('chat_messages')
                .select('id', { count: 'exact', head: true })
                .eq('sector_id', userSectorId)
                .neq('sender_id', userId)
                .gt('created_at', lastReadAt);

            if (!error && count) {
                sectorCount = count;
            }
        }

        return (dmCount || 0) + sectorCount;
    },

    // Helper to get all users for the sidebar list
    async fetchChatUsers() {
        const { data, error } = await supabase
            .from('profiles')
            .select('id, name, username, sector, role, jobTitle:job_title')
            .order('name');

        if (error) throw error;
        return data;
    },

    async fetchChatSectors() {
        const { data, error } = await supabase
            .from('sectors')
            .select('id, name')
            .order('name');

        if (error) throw error;
        return data;
    },

    async fetchRecentConversations(userId: string): Promise<{ userIds: string[], sectorIds: string[], metadata: Record<string, RecentConversation> }> {
        // Fetch cleared history first
        const { data: clearedHistory } = await supabase
            .from('chat_cleared_history')
            .select('target_id, target_type, cleared_at')
            .eq('user_id', userId);

        const clearedMap = new Map<string, string>();
        clearedHistory?.forEach(h => {
            clearedMap.set(`${h.target_type}-${h.target_id}`, h.cleared_at);
        });

        // NEW: Fetch Last Read Times for Unread Calculation
        const { data: readHistory } = await supabase
            .from('chat_last_read')
            .select('target_id, target_type, last_read_at')
            .eq('user_id', userId);

        const readMap = new Map<string, string>();
        readHistory?.forEach(h => {
            readMap.set(`${h.target_type}-${h.target_id}`, h.last_read_at);
        });


        // Buscar mensagens recentes otimizadas para montar histórico inicial
        const { data, error } = await supabase
            .from('chat_messages')
            .select('id, sender_id, receiver_id, sector_id, message, file_url, file_type, read, created_at')
            .or(`sender_id.eq.${userId},receiver_id.eq.${userId},sector_id.neq.null`)
            .order('created_at', { ascending: false })
            .limit(200);

        if (error) throw error;

        const recentUserIds = new Set<string>();
        const recentSectorIds = new Set<string>();
        const metadata: Record<string, RecentConversation> = {};

        // Helper to update metadata for a conversation key
        const updateMetadata = (key: string, type: 'user' | 'sector', msg: ChatMessage) => {
            if (!metadata[key]) {
                metadata[key] = {
                    id: key,
                    type,
                    lastMessage: msg.file_url ? (msg.file_type?.startsWith('image/') ? '📷 Imagem' : '📎 Arquivo') : msg.message,
                    unreadCount: 0,
                    timestamp: msg.created_at,
                    originalRef: msg
                };
            }

            // UNREAD LOGIC
            if (type === 'sector') {
                // For Sector: compare msg.created_at with last_read_at
                const lastRead = readMap.get(`sector-${key}`) || '1970-01-01';
                if (new Date(msg.created_at) > new Date(lastRead) && msg.sender_id !== userId) {
                    metadata[key].unreadCount += 1;
                }
            } else {
                // For User: stick to 'read' flag for now (or switch to time-based if robust)
                // Keeping 'read' flag logic for DMs as it's fully implemented
                if (!msg.read && msg.sender_id !== userId) {
                    metadata[key].unreadCount += 1;
                }
            }
        };

        data.forEach(msg => {
            let targetId = '';
            let type: 'user' | 'sector' = 'user';

            if (msg.sector_id) {
                targetId = msg.sector_id;
                type = 'sector';
            } else {
                targetId = msg.sender_id === userId ? msg.receiver_id! : msg.sender_id;
                type = 'user';
            }

            if (!targetId) return;

            // Check if cleared
            const clearedAt = clearedMap.get(`${type}-${targetId}`);
            if (clearedAt && new Date(msg.created_at) <= new Date(clearedAt)) {
                return; // Skip cleared message
            }

            // Add to lists
            if (type === 'sector') {
                recentSectorIds.add(targetId);
                updateMetadata(targetId, 'sector', msg);
            } else {
                recentUserIds.add(targetId);
                updateMetadata(targetId, 'user', msg);
            }
        });

        return {
            userIds: Array.from(recentUserIds),
            sectorIds: Array.from(recentSectorIds),
            metadata
        };
    },

    async deleteConversation(currentUserId: string, targetId: string, type: 'user' | 'sector') {
        // 1. Clear history (Soft Delete)
        const { error: upsertError } = await supabase
            .from('chat_cleared_history')
            .upsert({
                user_id: currentUserId,
                target_id: targetId,
                target_type: type,
                cleared_at: new Date().toISOString()
            }, { onConflict: 'user_id, target_id, target_type' });

        if (upsertError) throw upsertError;

        // 2. Mark unread messages as read (to fix badges)
        // Only existing unread messages where I am the receiver (or irrelevant for sector shared logic)
        // Simplified query: Update all unread messages in this conversation where I am NOT the sender.
        let query = supabase.from('chat_messages').update({ read: true }).eq('read', false).neq('sender_id', currentUserId);

        if (type === 'user') {
            query = query.or(`and(sender_id.eq.${targetId},receiver_id.eq.${currentUserId})`);
            // Note: only mark messages sent BY the other person TO me.
        } else {
            query = query.eq('sector_id', targetId);
        }

        const { error: updateError } = await query;
        if (updateError) {
            console.error('Error marking messages as read during deletion:', updateError);
            // Don't throw, as the primary action (clearing) succeeded.
        }
    }
};
