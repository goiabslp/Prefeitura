import { supabase } from './supabaseClient';

export interface AuditLog {
  id?: string;
  user_id?: string | null;
  user_name: string;
  user_email: string;
  action_type: string;
  module: string | null;
  description: string;
  details: any;
  created_at?: string;
}

let cachedUser: { id: string, name: string, email: string } | null = null;

export const auditLogService = {
  async getCurrentUser() {
    if (cachedUser) return cachedUser;

    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return null;

    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', user.id)
        .single();

      cachedUser = {
        id: user.id,
        name: (profile && !error) ? profile.name : (user.email || 'Usuário'),
        email: user.email || ''
      };
      return cachedUser;
    } catch (e) {
      console.error('Failed to get user profile for logs:', e);
      return {
        id: user.id,
        name: user.email || 'Usuário',
        email: user.email || ''
      };
    }
  },

  clearCache() {
    cachedUser = null;
  },

  async logAction(log: { action_type: string, module?: string | null, description: string, details?: any }) {
    try {
      const user = await this.getCurrentUser();

      const { error } = await supabase.from('audit_logs').insert([{
        user_id: user?.id || null,
        user_name: user?.name || 'Usuário Anônimo',
        user_email: user?.email || '',
        action_type: log.action_type,
        module: log.module || null,
        description: log.description,
        details: log.details || {}
      }]);
      
      if (error) {
        console.error('Error inserting log:', error);
      }
    } catch (err) {
      console.error('Failed to write audit log:', err);
    }
  },

  async fetchLogs(filters?: { date?: string, user_id?: string, action_type?: string }): Promise<AuditLog[]> {
    try {
      let query = supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false });

      if (filters?.date) {
        // Parse date boundaries using the local timezone to avoid timezone shift mismatch
        const startLocal = new Date(`${filters.date}T00:00:00`);
        const endLocal = new Date(`${filters.date}T23:59:59.999`);
        
        query = query
          .gte('created_at', startLocal.toISOString())
          .lte('created_at', endLocal.toISOString());
      }

      if (filters?.user_id) {
        query = query.eq('user_id', filters.user_id);
      }

      if (filters?.action_type) {
        query = query.eq('action_type', filters.action_type);
      }

      const { data, error } = await query.limit(500);
      if (error) throw error;
      return (data || []) as AuditLog[];
    } catch (err) {
      console.error('Failed to fetch logs:', err);
      return [];
    }
  }
};
