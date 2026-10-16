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

export interface LogActionParams {
  action_type: string;
  module?: string | null;
  description: string;
  details?: any;
  user?: {
    id?: string | null;
    name?: string;
    email?: string;
  } | null;
}

let activeCurrentUser: { id?: string | null; name: string; email: string } | null = null;
let cachedSessionUser: { id: string; name: string; email: string } | null = null;
let realtimeBroadcastChannel: ReturnType<typeof supabase.channel> | null = null;

const isValidUUID = (val?: string | null): boolean => {
  if (!val) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
};

function getBroadcastChannel() {
  if (!realtimeBroadcastChannel) {
    realtimeBroadcastChannel = supabase.channel('audit_logs_realtime_feed');
    realtimeBroadcastChannel.subscribe();
  }
  return realtimeBroadcastChannel;
}

export const auditLogService = {
  /**
   * Define o usuário atual da aplicação em memória para gravação instantânea e precisa
   */
  setCurrentUser(user: { id?: string | null; name?: string; email?: string } | null) {
    if (user && user.name) {
      activeCurrentUser = {
        id: user.id || null,
        name: user.name,
        email: user.email || ''
      };
    } else {
      activeCurrentUser = null;
    }
  },

  async getCurrentUser() {
    if (activeCurrentUser) return activeCurrentUser;
    if (cachedSessionUser) return cachedSessionUser;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return null;

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', user.id)
        .single();

      cachedSessionUser = {
        id: user.id,
        name: (profile && !error) ? profile.name : (user.email || 'Usuário'),
        email: user.email || ''
      };
      return cachedSessionUser;
    } catch (e) {
      console.warn('Falha ao obter perfil do usuário para logs:', e);
      return null;
    }
  },

  clearCache() {
    activeCurrentUser = null;
    cachedSessionUser = null;
  },

  /**
   * Registra log de auditoria no Supabase e transmite via Realtime Broadcast.
   * Se houver sessão de simulação / acompanhamento assistido ativa, preserva indelével:
   * Usuário Efetivo, Administrador Executor, Modo, Rota URL e Data/Hora com segundos.
   */
  async logAction(log: LogActionParams) {
    try {
      const user = log.user || await this.getCurrentUser();

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

      let rawUserId = user?.id || null;
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
        rawUserId = activeImpersonation.targetUser.id;
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

      // Validação estrita de UUID para evitar erro de sintaxe do Postgres
      const finalUserId = isValidUUID(rawUserId) ? rawUserId : null;
      if (rawUserId && !isValidUUID(rawUserId)) {
        finalDetails.custom_user_id = rawUserId;
      }

      const logPayload: AuditLog = {
        user_id: finalUserId,
        user_name: finalUserName,
        user_email: finalUserEmail,
        action_type: log.action_type,
        module: log.module || null,
        description: finalDescription,
        details: finalDetails,
        created_at: preciseTimestamp
      };

      // 1. Grava no banco de dados Supabase de forma assíncrona
      const insertPromise = supabase.from('audit_logs').insert([logPayload]).select('id').single();

      // 2. Dispara notificação Realtime em tempo real (Broadcast)
      try {
        const channel = getBroadcastChannel();
        channel.send({
          type: 'broadcast',
          event: 'new_audit_log',
          payload: logPayload
        }).catch(() => {});
      } catch (err) {
        // Fallback silencioso
      }

      // 3. Dispara evento local para abas da mesma janela
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('audit_log_created', { detail: logPayload }));
      }

      const { data: insertedData, error } = await insertPromise;
      if (error) {
        console.warn('Erro ao gravar log de auditoria no Supabase:', error.message);
      } else if (insertedData?.id) {
        logPayload.id = insertedData.id;
      }

      return logPayload;
    } catch (err) {
      console.warn('Falha ao processar log de auditoria:', err);
      return null;
    }
  },

  /**
   * Assina atualizações em tempo real dos logs de auditoria
   */
  subscribeToLogs(onNewLog: (log: AuditLog) => void): () => void {
    const channelName = `audit_logs_sub_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const channel = supabase.channel(channelName)
      .on('broadcast', { event: 'new_audit_log' }, (payload) => {
        if (payload?.payload) {
          onNewLog(payload.payload as AuditLog);
        }
      })
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'audit_logs' },
        (payload) => {
          if (payload?.new) {
            onNewLog(payload.new as AuditLog);
          }
        }
      )
      .subscribe();

    const handleLocal = (e: any) => {
      if (e.detail) {
        onNewLog(e.detail as AuditLog);
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('audit_log_created', handleLocal);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('audit_log_created', handleLocal);
      }
      supabase.removeChannel(channel);
    };
  },

  async fetchLogs(filters?: { date?: string; user_id?: string; action_type?: string }): Promise<AuditLog[]> {
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

      if (filters?.action_type && filters.action_type !== 'all') {
        query = query.eq('action_type', filters.action_type);
      }

      const { data, error } = await query.limit(1000);
      if (error) throw error;
      return (data || []) as AuditLog[];
    } catch (err) {
      console.warn('Falha ao buscar logs de auditoria:', err);
      return [];
    }
  }
};

