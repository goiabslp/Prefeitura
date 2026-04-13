
import { supabase } from './supabaseClient';
import { Order, InventoryItem, InventoryCategory, PurchaseAccount } from '../types';
import { notificationService } from './notificationService';

import { handleSupabaseError } from '../utils/errorUtils';

export const getAllPurchaseOrders = async (lightweight = true, page = 0, limit = 1000, searchTerm = '', status?: string, purchaseStatus?: string): Promise<Order[]> => {
    // ... select specific columns
    const columns = lightweight
        ? `id, protocol, title, status, purchase_status, status_history, created_at, user_id, user_name, completion_forecast, budget_file_url,
           requester_name:document_snapshot->content->>requesterName,
           requester_sector:document_snapshot->content->>requesterSector,
           priority:document_snapshot->content->>priority,
           selected_account:document_snapshot->content->>selectedAccount,
           profiles:user_id(sector)`
        : '*, profiles:user_id(sector)';

    let query = supabase
        .from('purchase_orders')
        .select(columns)
        .order('created_at', { ascending: false });

    if (searchTerm) {
        // Normalizing search term for optimal matching (ignoring accents and special characters)
        const normalizedTerm = searchTerm
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '') // Remove accents
            .replace(/[^a-z0-9\s]/g, '') // Remove special chars
            .trim();

        if (normalizedTerm) {
            // First attempt to use the optimized search_index column (if applied via migration)
            query = query.or(`search_index.ilike.% ${normalizedTerm}%, protocol.ilike.% ${searchTerm}%, title.ilike.% ${searchTerm}%, user_name.ilike.% ${searchTerm}% `);
        } else {
            // Fallback for searches containing only special characters
            query = query.or(`protocol.ilike.% ${searchTerm}%, title.ilike.% ${searchTerm}%, user_name.ilike.% ${searchTerm}% `);
        }
    }

    if (status) {
        if (status === 'pending_approval') {
            query = query.or('status.eq.pending,status.eq.awaiting_approval');
        } else {
            query = query.eq('status', status);
        }
    }

    if (purchaseStatus) {
        query = query.eq('purchase_status', purchaseStatus);
    }

    if (lightweight) {
        const from = page * limit;
        const to = from + limit - 1;
        query = query.range(from, to);
    }

    const { data, error } = await query;

    if (error) {
        const appError = handleSupabaseError(error);
        console.error('[comprasService] Error:', appError.message);
        throw appError;
    }

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
        blockType: 'compras',
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
            content: {
                title: item.title,
                requesterName: item.requester_name,
                requesterSector: item.requester_sector || item.profiles?.sector,
                priority: item.priority,
                selectedAccount: item.selected_account
            }
        } as any : item.document_snapshot,
        budgetFileUrl: item.budget_file_url,
        attachments: item.attachments,
        completionForecast: item.completion_forecast,
        requestingSector: item.requester_sector || item.profiles?.sector
    }));
};

export const getPurchaseOrderById = async (id: string): Promise<Order> => {
    const { data, error } = await supabase
        .from('purchase_orders')
        .select('*')
        .eq('id', id)
        .single();

    if (error) throw error;

    return {
        id: data.id,
        protocol: data.protocol,
        title: data.title,
        status: data.status,
        purchaseStatus: data.purchase_status,
        statusHistory: data.status_history,
        createdAt: data.created_at,
        userId: data.user_id,
        userName: data.user_name,
        blockType: 'compras',
        documentSnapshot: data.document_snapshot,
        budgetFileUrl: data.budget_file_url,
        attachments: data.attachments,
        completionForecast: data.completion_forecast
    };
};

export const savePurchaseOrder = async (order: Order): Promise<void> => {
    const dbOrder = {
        id: order.id,
        protocol: order.protocol,
        title: order.title,
        status: order.status,
        purchase_status: order.purchaseStatus,
        status_history: order.statusHistory,
        created_at: order.createdAt,
        user_id: order.userId,
        user_name: order.userName,
        document_snapshot: order.documentSnapshot,
        budget_file_url: order.budgetFileUrl,
        attachments: order.attachments,
        completion_forecast: order.completionForecast
    };

    // Backend Validation
    let isNewOrder = false;
    if (order.id) {
        const { data: current } = await supabase.from('purchase_orders').select('status, document_snapshot').eq('id', order.id).maybeSingle();
        if (current) {
            if (current.status === 'rejected' && order.status !== 'rejected') {
                throw new Error("Validação de Segurança: Pedido de compra rejeitado não pode ser editado nem modificado.");
            }
        } else {
            isNewOrder = true;
        }
    } else {
        isNewOrder = true;
    }

    // Rule: Mandatory account for ALL purchase orders (creation and update)
    const hasAccount = order.documentSnapshot?.content?.selectedAccount;
    if (!hasAccount) {
        throw new Error("Validação de Segurança: A conta de pagamento é obrigatória para o pedido.");
    }

    const { error } = await supabase.from('purchase_orders').upsert(dbOrder);
    if (error) throw error;

    // INVENTORY RESERVATION: If new order, reserve inventory mapped items
    if (isNewOrder && order.documentSnapshot?.content?.purchaseItems) {
        for (const item of order.documentSnapshot.content.purchaseItems) {
            if (item.inventory_item_id && item.quantity > 0) {
                const { data: invItem } = await supabase.from('procurement_inventory').select('reserved_quantity').eq('id', item.inventory_item_id).single();
                if (invItem) {
                    const currentRes = invItem.reserved_quantity || 0;
                    await supabase.from('procurement_inventory').update({
                        reserved_quantity: currentRes + item.quantity
                    }).eq('id', item.inventory_item_id);
                }
            }
        }
    }
};

export const deletePurchaseOrder = async (id: string): Promise<void> => {
    const { error } = await supabase.from('purchase_orders').delete().eq('id', id);
    if (error) throw error;
};

export const uploadPurchaseAttachment = async (blob: Blob, fileName: string): Promise<string> => {
    // 1. Upload file
    const { data, error } = await supabase.storage
        .from('chat-attachments') // Reusing existing bucket or create 'documents'
        .upload(`compras / ${fileName} `, blob, {
            contentType: 'application/pdf',
            upsert: true
        });

    if (error) throw error;

    // 2. Get Public URL
    const { data: { publicUrl } } = supabase.storage
        .from('chat-attachments')
        .getPublicUrl(`compras / ${fileName} `);

    return publicUrl;
};

export const updateAttachments = async (id: string, attachments: any[]): Promise<void> => {
    // Backend Validation
    const { data: current, error: fetchError } = await supabase.from('purchase_orders').select('status').eq('id', id).single();
    if (fetchError) throw fetchError;
    if (current?.status === 'rejected') {
        throw new Error("Validação de Segurança: Ação bloqueada em pedido rejeitado.");
    }

    const { error } = await supabase
        .from('purchase_orders')
        .update({ attachments: attachments })
        .eq('id', id);
    if (error) throw error;
};

export const updateOrderStatus = async (id: string, status: string, historyEntry: any): Promise<void> => {
    // 1. Fetch current status/history for validation and merging
    const { data: current, error: fetchError } = await supabase
        .from('purchase_orders')
        .select('status, status_history, document_snapshot')
        .eq('id', id)
        .single();

    if (fetchError) throw fetchError;

    // RULE: Rejection is final
    if (current?.status === 'rejected' && status !== 'rejected') {
        throw new Error("Validação de Segurança: Pedido rejeitado não pode ser alterado.");
    }

    // NEW MANDATORY RULE: Admin approval always transitions to "Conta de Pagamento"
    let finalStatus = status;
    const selectedAccount = current?.document_snapshot?.content?.selectedAccount;

    if (status === 'approved') {
        // Automatically route the true status to payment_account upon Admin Approval
        finalStatus = 'payment_account';

        // Adjust history entry to reflect it is awaiting the account confirmation
        if (historyEntry.statusLabel === 'Aprovação Administrativa') {
            historyEntry.statusLabel = 'Aprovação Administrativa (Aguardando Conta)';
        }
    }

    // NEW MANDATORY RULE: Cannot progress beyond 'payment_account' or 'pending' without an account
    // If the user tries to move to 'in_progress' or any other active status but there's no account
    const activeStatuses = ['in_progress', 'finishing', 'completed'];
    if (activeStatuses.includes(status) && !selectedAccount) {
        throw new Error("Validação de Segurança: É obrigatório informar a conta para que o pedido possa avançar.");
    }

    // RULE: Admin approval/rejection only allowed if current status is "Em Aprovação" (pending/awaiting_approval)
    if (status === 'approved' || status === 'rejected') {
        const isEmAprovacao = !current?.status || current.status === 'pending' || current.status === 'awaiting_approval';
        if (!isEmAprovacao) {
            throw new Error("Validação de Segurança: A aprovação ou rejeição só é permitida enquanto o pedido está em fase de aprovação inicial.");
        }
    }

    const newHistory = [...(current?.status_history || []), historyEntry];

    const { error } = await supabase
        .from('purchase_orders')
        .update({
            status: finalStatus,
            status_history: newHistory
        })
        .eq('id', id);

    if (error) throw error;

    // INVENTORY ROLLBACK: If cancelled or rejected, rollback reservations
    if ((finalStatus === 'canceled' || finalStatus === 'rejected') && current.status !== 'canceled' && current.status !== 'rejected') {
        if (current.document_snapshot?.content?.purchaseItems) {
            for (const item of current.document_snapshot.content.purchaseItems) {
                if (item.inventory_item_id && item.quantity > 0) {
                    const { data: invItem } = await supabase.from('procurement_inventory').select('reserved_quantity').eq('id', item.inventory_item_id).single();
                    if (invItem) {
                        const currentRes = invItem.reserved_quantity || 0;
                        const newRes = Math.max(0, currentRes - item.quantity); // Prevent negative
                        await supabase.from('procurement_inventory').update({
                            reserved_quantity: newRes
                        }).eq('id', item.inventory_item_id);
                    }
                }
            }
        }
    }
};

export const updateCompletionForecast = async (id: string, forecast: string): Promise<void> => {
    // Validate not rejected
    const { data: current, error: fetchError } = await supabase.from('purchase_orders').select('status').eq('id', id).single();
    if (fetchError) throw fetchError;
    if (current?.status === 'rejected') {
        throw new Error("Validação de Segurança: Ação bloqueada em pedido rejeitado.");
    }

    const { error } = await supabase
        .from('purchase_orders')
        .update({ completion_forecast: forecast })
        .eq('id', id);
    if (error) throw error;
};

export const updatePurchaseStatus = async (id: string, status: string, historyEntry: any | null, budgetFileUrl?: string, completionForecast?: string): Promise<void> => {
    // 1. Fetch current history to ensure we append to the latest version + Backend Validation
    const { data: current, error: fetchError } = await supabase
        .from('purchase_orders')
        .select('status_history, status, purchase_status, completion_forecast, document_snapshot')
        .eq('id', id)
        .single();

    if (fetchError) throw fetchError;
    if (current?.status === 'rejected') {
        throw new Error("Validação de Segurança: Não é possível avançar etapas nem interagir com um pedido já rejeitado.");
    }

    // NEW MANDATORY RULE: Must have an account to update purchase status
    if (!current?.document_snapshot?.content?.selectedAccount) {
        throw new Error("Validação de Segurança: É obrigatório informar a conta para que o pedido possa avançar para o próximo status.");
    }

    // MANDATORY RULE: Pedido Realizado requires Previsão
    if (status === 'realizado' && !completionForecast) {
        throw new Error("Validação de Segurança: A data de previsão é obrigatória para marcar o pedido como realizado.");
    }

    const currentHistory = current?.status_history || [];
    const newHistory = historyEntry ? [...currentHistory, historyEntry] : currentHistory;

    const updatePayload: any = {
        purchase_status: status,
        status_history: newHistory
    };

    if (budgetFileUrl) {
        updatePayload.budget_file_url = budgetFileUrl;
    }

    if (completionForecast) {
        updatePayload.completion_forecast = completionForecast;
    }

    const { error } = await supabase
        .from('purchase_orders')
        .update(updatePayload)
        .eq('id', id);

    if (error) throw error;

    // INVENTORY WITHDRAWAL: If item is concluded/realized, definitively withdraw from physical stock and clear from reservation pool
    if ((status === 'concluido' || status === 'realizado') && current.purchase_status !== 'concluido' && current.purchase_status !== 'realizado') {
        if (current.document_snapshot?.content?.purchaseItems) {
            for (const item of current.document_snapshot.content.purchaseItems) {
                if (item.inventory_item_id && item.quantity > 0) {
                    const { data: invItem } = await supabase.from('procurement_inventory').select('quantity, reserved_quantity').eq('id', item.inventory_item_id).single();
                    if (invItem) {
                        const currentQty = invItem.quantity || 0;
                        const currentRes = invItem.reserved_quantity || 0;
                        
                        const newQty = Math.max(0, currentQty - item.quantity);
                        const newRes = Math.max(0, currentRes - item.quantity);

                        await supabase.from('procurement_inventory').update({
                            quantity: newQty,
                            reserved_quantity: newRes
                        }).eq('id', item.inventory_item_id);
                    }
                }
            }
        }
    }

    // Notification Trigger
    // Fetch order to get user_id notification target
    const { data: order } = await supabase.from('purchase_orders').select('user_id, protocol, title').eq('id', id).single();

    if (order && order.user_id) {

        let type = 'info';
        if (status === 'concluido' || status === 'realizado') type = 'success';
        if (status === 'cancelado') type = 'error';

        await notificationService.createNotification({
            user_id: order.user_id,
            title: 'Atualização de Pedido de Compra',
            message: `O pedido ${order.protocol} (${order.title}) mudou para: ${status} `,
            type: type as any,
            link: '/Compras' // or specific link
        });
    }
};

export const getInventoryItems = async (isTendered?: boolean, category?: string): Promise<InventoryItem[]> => {
    let query = supabase
        .from('procurement_inventory')
        .select('*')
        .order('created_at', { ascending: false });

    if (isTendered !== undefined) {
        query = query.eq('is_tendered', isTendered);
    }

    if (category) {
        query = query.eq('category', category);
    }

    const { data, error } = await query;
    if (error) {
        throw error;
    }
    return data as InventoryItem[];
};

export const addToInventory = async (item: Omit<InventoryItem, 'id' | 'created_at' | 'updated_at'>): Promise<InventoryItem> => {
    const { data, error } = await supabase
        .from('procurement_inventory')
        .insert(item)
        .select()
        .single();

    if (error) throw error;
    return data as InventoryItem;
};

export const updateInventoryItem = async (id: string, updates: Partial<InventoryItem>): Promise<InventoryItem> => {
    const { data, error } = await supabase
        .from('procurement_inventory')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
    if (error) throw error;
    return data as InventoryItem;
};

export const deleteInventoryItem = async (id: string): Promise<void> => {
    const { error } = await supabase
        .from('procurement_inventory')
        .delete()
        .eq('id', id);
    if (error) throw error;
};

export const restoreItemToTendered = async (inventoryItemId: string): Promise<void> => {
    // 1. Get Inventory Item
    const { data: inventoryItem, error: invError } = await supabase
        .from('procurement_inventory')
        .select('*')
        .eq('id', inventoryItemId)
        .single();

    if (invError) throw invError;

    // 2. Update Inventory Status
    const { error: updateError } = await supabase
        .from('procurement_inventory')
        .update({ is_tendered: true })
        .eq('id', inventoryItemId);

    if (updateError) throw updateError;

    // 3. If linked to an order, restore it there too
    if (inventoryItem.original_order_protocol && inventoryItem.original_item_id) {
        // Fetch order
        const { data: order, error: orderError } = await supabase
            .from('purchase_orders')
            .select('*')
            .eq('protocol', inventoryItem.original_order_protocol)
            .single();

        if (order && !orderError && order.document_snapshot?.content?.purchaseItems) {
            const content = order.document_snapshot.content;
            const updatedItems = content.purchaseItems.map((item: any) => {
                if (item.id === inventoryItem.original_item_id) {
                    // Remove isTendered flag or set to true (removing false)
                    // We remove the flag so it returns to "default" state
                    const { isTendered, category, ...rest } = item;
                    return rest;
                }
                return item;
            });

            // Save updated order
            const updatedSnapshot = {
                ...order.document_snapshot,
                content: {
                    ...content,
                    purchaseItems: updatedItems
                }
            };

            const { error: saveError } = await supabase
                .from('purchase_orders')
                .update({ document_snapshot: updatedSnapshot })
                .eq('id', order.id);

            if (saveError) {
                console.error("Error updating original order on restore:", saveError);
                // We don't throw here to avoid rolling back the inventory change, 
                // but ideally we should confirm both. For now, best effort sync.
            }
        }
    }
};

export const getPurchaseAccounts = async (): Promise<PurchaseAccount[]> => {
    const { data, error } = await supabase
        .from('purchase_accounts')
        .select('*')
        .order('description', { ascending: true });
    if (error) throw error;
    return data as PurchaseAccount[];
};

export const createPurchaseAccount = async (account: Partial<PurchaseAccount>): Promise<PurchaseAccount> => {
    const { data, error } = await supabase
        .from('purchase_accounts')
        .insert([account])
        .select()
        .single();
    if (error) throw error;
    return data as PurchaseAccount;
};

export const updateOrderAccount = async (orderId: string, accountDescription: string, userName: string, advanceStatus: boolean = false, isAdmin: boolean = false): Promise<void> => {
    // Permission Backend Check
    if (advanceStatus && !isAdmin) {
        throw new Error("Permissão Negada: Apenas administradores podem aprovar a conta de pagamento.");
    }

    // 1. Fetch current order
    const { data: order, error: fetchError } = await supabase
        .from('purchase_orders')
        .select('document_snapshot, status, status_history')
        .eq('id', orderId)
        .single();
    if (fetchError) throw fetchError;

    // 2. Update snapshot
    const content = order.document_snapshot.content;
    const updatedSnapshot = {
        ...order.document_snapshot,
        content: {
            ...content,
            selectedAccount: accountDescription
        }
    };

    // 3. Prepare status update (advance to approved if requested)
    const newMovement = {
        statusLabel: advanceStatus ? 'Conta Vinculada e Aprovada: ' + accountDescription : 'Conta Vinculada/Alterada: ' + accountDescription,
        date: new Date().toISOString(),
        userName: userName
    };

    const finalHistory = [...(order.status_history || []), newMovement];

    const updatePayload: any = {
        document_snapshot: updatedSnapshot,
        status_history: finalHistory
    };

    if (advanceStatus) {
        updatePayload.status = 'approved';
    }

    // 4. Save
    const { error: updateError } = await supabase
        .from('purchase_orders')
        .update(updatePayload)
        .eq('id', orderId);

    if (updateError) throw updateError;
};
