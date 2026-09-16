
import { supabase } from './supabaseClient';
import { Order } from '../types';

export const getAllOrders = async (): Promise<Order[]> => {
    const { data, error } = await supabase
        .from('orders')
        .select('id, protocol, title, status, purchase_status, status_history, created_at, user_id, user_name, block_type, document_snapshot')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching orders:', error);
        return [];
    }

    // Map snake_case to camelCase
    return data.map((item: any) => ({
        id: item.id,
        protocol: item.protocol,
        title: item.title,
        status: item.status,
        purchaseStatus: item.purchase_status,
        statusHistory: item.status_history,
        createdAt: item.created_at,
        userId: item.user_id,
        userName: item.user_name,
        blockType: item.block_type,
        documentSnapshot: item.document_snapshot,
        paymentStatus: item.payment_status,
        paymentDate: item.payment_date,
        budgetFileUrl: item.budget_file_url,
        attachments: item.attachments,
        completionForecast: item.completion_forecast
    }));
};

export const saveOrder = async (order: Order): Promise<void> => {
    // Map camelCase to snake_case
    const dbOrder = {
        id: order.id,
        protocol: order.protocol,
        title: order.title,
        status: order.status,
        purchase_status: order.purchaseStatus,
        status_history: order.statusHistory,
        created_at: order.createdAt,
        user_id: order.userId, // Ensure this is a valid UUID if using foreign keys
        user_name: order.userName,
        block_type: order.blockType,
        document_snapshot: order.documentSnapshot,
        payment_status: order.paymentStatus,
        payment_date: order.paymentDate,
        budget_file_url: order.budgetFileUrl,
        attachments: order.attachments,
        completion_forecast: order.completionForecast
    };

    const { error } = await supabase
        .from('orders')
        .upsert(dbOrder);

    if (error) {
        console.error('Error saving order:', error);
        throw error;
    }
};

export const deleteOrder = async (id: string): Promise<void> => {
    const { error } = await supabase
        .from('orders')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting order:', error);
        throw error;
    }
};
