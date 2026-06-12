
import { supabase } from './supabaseClient';
import { Order } from '../types';

export const getAllOficios = async (lightweight = true, page = 0, limit = 50, searchTerm = ''): Promise<Order[]> => {
    const columns = lightweight
        ? `id, protocol, title, status, status_history, created_at, user_id, user_name, description`
        : '*';

    let query = supabase
        .from('oficios')
        .select(columns)
        .order('created_at', { ascending: false });

    if (searchTerm) {
        query = query.or(`protocol.ilike.%${searchTerm}%,title.ilike.%${searchTerm}%,user_name.ilike.%${searchTerm}%`);
    }

    if (lightweight) {
        const from = page * limit;
        const to = from + limit - 1;
        query = query.range(from, to);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching oficios:', error.message, error.details, error.hint);
        return [];
    }

    return data.map((item: any) => ({
        id: item.id,
        protocol: item.protocol,
        title: item.title,
        status: item.status,
        statusHistory: item.status_history,
        createdAt: item.created_at,
        userId: item.user_id,
        userName: item.user_name,
        blockType: 'oficio',
        documentSnapshot: lightweight ? {
            branding: {
                logoUrl: null,
                primaryColor: '#4f46e5',
                secondaryColor: '#0f172a',
                fontFamily: 'font-sans' as any,
                logoWidth: 76,
                logoAlignment: 'left' as any,
                watermark: {
                    enabled: false,
                    imageUrl: null,
                    opacity: 20,
                    size: 55,
                    grayscale: true
                }
            },
            document: {
                headerText: '',
                footerText: '',
                city: '',
                showDate: true,
                showPageNumbers: true,
                showSignature: false,
                showLeftBlock: true,
                showRightBlock: true,
                titleStyle: { size: 12, color: '#000000', alignment: 'left' as any },
                leftBlockStyle: { size: 10, color: '#000000' },
                rightBlockStyle: { size: 10, color: '#000000' }
            },
            ui: {
                loginLogoUrl: null,
                loginLogoHeight: 80,
                headerLogoUrl: null,
                headerLogoHeight: 40,
                homeLogoPosition: 'left' as any
            },
            isLightweight: true,
            content: {
                requesterSector: undefined
            }
        } as any : item.document_snapshot,
        description: item.description,
        requestingSector: undefined
    }));
};

export const getOficioById = async (id: string): Promise<Order | null> => {
    const { data, error } = await supabase
        .from('oficios')
        .select('*')
        .eq('id', id)
        .single();

    if (error) {
        console.error('Error fetching oficio details:', error);
        return null;
    }

    return {
        id: data.id,
        protocol: data.protocol,
        title: data.title,
        status: data.status,
        statusHistory: data.status_history,
        createdAt: data.created_at,
        userId: data.user_id,
        userName: data.user_name,
        blockType: 'oficio',
        documentSnapshot: data.document_snapshot,
        description: data.description
    };
};

export const saveOficio = async (order: Order): Promise<void> => {
    const dbOrder = {
        id: order.id,
        protocol: order.protocol,
        title: order.title,
        status: order.status,
        status_history: order.statusHistory,
        created_at: order.createdAt,
        user_id: order.userId,
        user_name: order.userName,
        document_snapshot: order.documentSnapshot,
        description: order.description
    };

    const { error } = await supabase.from('oficios').upsert(dbOrder);
    if (error) throw error;
};

export const updateOficioDescription = async (id: string, description: string): Promise<void> => {
    const { error } = await supabase.from('oficios').update({ description }).eq('id', id);
    if (error) throw error;
};

export const deleteOficio = async (id: string): Promise<void> => {
    const { error } = await supabase.from('oficios').delete().eq('id', id);
    if (error) throw error;
};
