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
      console.error('Falha ao obter perfil do usuário para logs:', e);
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

  /**
   * Registra log de auditoria no Supabase.
   * Se houver sessão de simulação / acompanhamento assistido ativa, preserva indelével:
   * Usuário Efetivo, Administrador Executor, Modo, Rota URL e Data/Hora com segundos.
   */
  async logAction(log: { action_type: string, module?: string | null, description: string, details?: any }) {
    try {
      const user = await this.getCurrentUser();

      // Recupera sessão ativa de simulação do sessionStorage
      let activeImpersonation: any = null;
      if (typeof window !== 'undefined') {
        try {
          const raw = window.sessionStorage.getItem('sys_active_impersonation_session');
          if (raw) {
            const parsed = JSON.parse(raw);
            if (new Date(parsed.expiresAt).getTime() > Date.now()) {
              activeImpersonation = parsed;
            }
          }
        } catch (e) {
          // Fallback silencioso
        }
      }

      let finalUserId = user?.id || null;
      let finalUserName = user?.name || 'Usuário';
      let finalUserEmail = user?.email || '';
      let finalDescription = log.description;
      const finalDetails = { ...(log.details || {}) };
      const currentRoute = typeof window !== 'undefined' ? window.location.pathname : '';
      const preciseTimestamp = new Date().toISOString();

      // Se a ação for o próprio início ou término da simulação, trata com clareza
      const isImpersonationLifecycle = log.action_type === 'IMPERSONATION_START' || log.action_type === 'IMPERSONATION_END' || log.action_type === 'ASSISTED_SESSION_START';

      if (activeImpersonation && !isImpersonationLifecycle) {
        // Usuário efetivo é o usuário simulado, mas a autoria do administrador real é gravada
        finalUserId = activeImpersonation.targetUser.id;
        finalUserName = `${activeImpersonation.targetUser.name} (Simulado por Admin: ${activeImpersonation.realAdmin.name})`;
        finalUserEmail = activeImpersonation.targetUser.email || activeImpersonation.realAdmin.email || '';
        
        finalDescription = `[SIMULAÇÃO ASSISTIDA] Usuário efetivo: ${activeImpersonation.targetUser.name} (@${activeImpersonation.targetUser.username}) | Executado por: ${activeImpersonation.realAdmin.name} (@${activeImpersonation.realAdmin.username}) | Rota: ${currentRoute} | ${log.description}`;
        
        finalDetails.audit_simulation = {
          is_assisted_simulation: true,
          mode: 'Simulação Assistida',
          effective_user: {
            id: activeImpersonation.targetUser.id,
            name: activeImpersonation.targetUser.name,
            username: activeImpersonation.targetUser.username,
            email: activeImpersonation.targetUser.email,
            role: activeImpersonation.targetUser.role,
            sector: activeImpersonation.targetUser.sector
          },
          executed_by_admin: {
            id: activeImpersonation.realAdmin.id,
            name: activeImpersonation.realAdmin.name,
            username: activeImpersonation.realAdmin.username,
            email: activeImpersonation.realAdmin.email,
            role: activeImpersonation.realAdmin.role
          },
          session_id: activeImpersonation.sessionId,
          route: currentRoute,
          operation: log.action_type,
          timestamp_precise: preciseTimestamp
        };
      }

      const { error } = await supabase.from('audit_logs').insert([{
        user_id: finalUserId,
        user_name: finalUserName,
        user_email: finalUserEmail,
        action_type: log.action_type,
        module: log.module || null,
        description: finalDescription,
        details: finalDetails,
        created_at: preciseTimestamp
      }]);
      
      if (error) {
        console.error('Erro ao gravar log de auditoria:', error);
      }
    } catch (err) {
      console.error('Falha ao processar log de auditoria:', err);
    }
  },

  async fetchLogs(filters?: { date?: string, user_id?: string, action_type?: string }): Promise<AuditLog[]> {
    try {
      let query = supabase
        .from('audit_logs')
        .select('id, user_id, user_name, user_email, action_type, module, description, details, created_at')
        .order('created_at', { ascending: false });

      if (filters?.date) {
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
      console.error('Falha ao buscar logs de auditoria:', err);
      return [];
    }
  }
};
