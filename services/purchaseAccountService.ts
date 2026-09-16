import { supabase } from './supabaseClient';
import { PurchaseAccount } from '../types';

export const purchaseAccountService = {
    async getAccounts(): Promise<PurchaseAccount[]> {
        const { data, error } = await supabase
            .from('purchase_accounts')
            .select('id, agency, account_number, description, sector, status, ficha, resolucao, created_at, created_by')
            .order('account_number', { ascending: true });

        if (error) {
            console.error('Error fetching purchase accounts:', error);
            return [];
        }
        return data || [];
    },

    async requestAccount(account: Omit<PurchaseAccount, 'id' | 'created_at' | 'status'>): Promise<PurchaseAccount | null> {
        const { data, error } = await supabase
            .from('purchase_accounts')
            .insert([
                {
                    ...account,
                    status: 'Pendente'
                }
            ])
            .select()
            .single();

        if (error) {
            console.error('Error requesting new account:', error);
            return null;
        }
        return data;
    },

    async approveAccount(id: string): Promise<boolean> {
        const { error } = await supabase
            .from('purchase_accounts')
            .update({ status: 'Ativa' })
            .eq('id', id);

        if (error) {
            console.error('Error approving account:', error);
            return false;
        }
        return true;
    },

    async rejectAccount(id: string): Promise<boolean> {
        const { error } = await supabase
            .from('purchase_accounts')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error rejecting/deleting account:', error);
            return false;
        }
        return true;
    },

    async deleteAccount(id: string): Promise<boolean> {
        const { error } = await supabase
            .from('purchase_accounts')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting account:', error);
            return false;
        }
        return true;
    }
};
