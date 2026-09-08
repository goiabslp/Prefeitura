import { User, UserRole } from '../types';
import { isSuperAdminUser } from './permissionService';
import { auditLogService } from './auditLogService';
import { supabase } from './supabaseClient';

export interface ImpersonationSession {
  sessionId: string;
  realAdmin: {
    id: string;
    name: string;
    username: string;
    email: string;
    role: UserRole;
    sector?: string;
  };
  targetUser: User;
  startedAt: string;
  expiresAt: string;
  ipOrDevice?: string;
}

const STORAGE_KEY = 'sys_active_impersonation_session';
// Duração máxima padrão de uma sessão temporária de impersonação: 60 minutos
const SESSION_DURATION_MS = 60 * 60 * 1000;

export const impersonationService = {
  /**
   * Obtém a sessão de impersonação ativa armazenada no sessionStorage.
   * Valida automaticamente se o tempo de expiração foi atingido.
   */
  getActiveImpersonation(): ImpersonationSession | null {
    if (typeof window === 'undefined') return null;

    try {
      const raw = window.sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return null;

      const session: ImpersonationSession = JSON.parse(raw);
      const expiresAt = new Date(session.expiresAt).getTime();

      // Expiração automática por tempo limite
      if (Date.now() > expiresAt) {
        console.warn('[Impersonation] Sessão temporária expirou por limite de tempo.');
        this.clearSession();
        return null;
      }

      return session;
    } catch (e) {
      console.error('[Impersonation] Erro ao recuperar sessão do storage:', e);
      return null;
    }
  },

  /**
   * Verifica se há uma sessão de impersonação ativa e válida.
   */
  isImpersonating(): boolean {
    return this.getActiveImpersonation() !== null;
  },

  /**
   * Inicia uma nova sessão de impersonação temporária.
   * Valida que o solicitante é administrador e não está impersonando a si próprio.
   * Registra imediatamente o evento no log de auditoria e notifica o usuário via broadcast.
   */
  async startImpersonation(realAdmin: User, targetUser: User): Promise<ImpersonationSession> {
    if (!realAdmin) {
      throw new Error('Administrador não autenticado para iniciar impersonação.');
    }

    // Validação estrita: somente administradores autorizados ou GAF
    const isAdmin = isSuperAdminUser(realAdmin) || realAdmin.role === 'admin' || (realAdmin as any).realRole === 'admin';
    if (!isAdmin) {
      throw new Error('Acesso negado: apenas administradores autorizados podem utilizar a impersonação.');
    }

    // Regra: não permitir auto-impersonação
    if (targetUser.id === realAdmin.id) {
      throw new Error('Operação inválida: não é permitido impersonar sua própria conta.');
    }

    const sessionId = `imp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const startedAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();

    const ipOrDevice = typeof navigator !== 'undefined'
      ? `${navigator.userAgent} (${navigator.platform || 'Desconhecido'})`
      : 'Desconhecido';

    const session: ImpersonationSession = {
      sessionId,
      realAdmin: {
        id: realAdmin.id,
        name: realAdmin.name || realAdmin.username,
        username: realAdmin.username,
        email: realAdmin.email || '',
        role: realAdmin.role,
        sector: realAdmin.sector
      },
      targetUser: {
        ...targetUser,
        // Garante que senhas nunca sejam armazenadas na sessão
        password: undefined as any,
        tempPassword: undefined
      },
      startedAt,
      expiresAt,
      ipOrDevice
    };

    // Armazena na sessão do navegador (sessionStorage)
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));

    // Auditoria de início de sessão
    await auditLogService.logAction({
      action_type: 'IMPERSONATION_START',
      module: 'Segurança / Admin',
      description: `Administrador "${realAdmin.name}" (@${realAdmin.username}) iniciou sessão temporária de impersonação acessando como "${targetUser.name}" (@${targetUser.username}).`,
      details: {
        sessionId,
        admin_id: realAdmin.id,
        admin_name: realAdmin.name,
        admin_username: realAdmin.username,
        admin_email: realAdmin.email,
        target_user_id: targetUser.id,
        target_user_name: targetUser.name,
        target_user_username: targetUser.username,
        target_user_role: targetUser.role,
        target_user_sector: targetUser.sector,
        target_user_permissions_count: targetUser.permissions?.length || 0,
        started_at: startedAt,
        expires_at: expiresAt,
        ip_device: ipOrDevice
      }
    });

    // Transmite aviso em tempo real para o usuário acessado (não permitir impersonação silenciosa)
    try {
      const payload = {
        targetUserId: targetUser.id,
        targetUserName: targetUser.name,
        targetUsername: targetUser.username,
        targetEmail: targetUser.email || '',
        adminName: realAdmin.name,
        adminEmail: realAdmin.email || '',
        startedAt,
        sessionId
      };

      // Dispara nos canais com garantia de conexão
      const ch1 = supabase.channel('global_events');
      if (ch1.state === 'joined') {
        ch1.send({ type: 'broadcast', event: 'impersonation-started', payload });
      } else {
        ch1.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            ch1.send({ type: 'broadcast', event: 'impersonation-started', payload });
          }
        });
      }

      const ch2 = supabase.channel('user_impersonation_alerts');
      if (ch2.state === 'joined') {
        ch2.send({ type: 'broadcast', event: 'impersonation-started', payload });
      } else {
        ch2.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            ch2.send({ type: 'broadcast', event: 'impersonation-started', payload });
          }
        });
      }
    } catch (broadcastErr) {
      console.warn('[Impersonation] Erro ao transmitir broadcast de início:', broadcastErr);
    }

    console.info(`[Impersonation] Sessão iniciada com sucesso. Admin: ${realAdmin.name} -> Visualizando como: ${targetUser.name}`);
    return session;
  },

  /**
   * Encerra a sessão de impersonação ativa.
   * Calcula o tempo de duração, registra o log de encerramento e avisa o usuário do encerramento.
   */
  async stopImpersonation(): Promise<{ success: boolean; durationSeconds: number } | null> {
    const session = this.getActiveImpersonation();
    if (!session) {
      this.clearSession();
      return null;
    }

    const endedAt = new Date();
    const startedAt = new Date(session.startedAt);
    const durationSeconds = Math.round((endedAt.getTime() - startedAt.getTime()) / 1000);
    const durationMinutes = (durationSeconds / 60).toFixed(1);

    // Auditoria de encerramento
    await auditLogService.logAction({
      action_type: 'IMPERSONATION_END',
      module: 'Segurança / Admin',
      description: `Administrador "${session.realAdmin.name}" encerrou a sessão de impersonação de "${session.targetUser.name}". Duração total: ${durationMinutes} min (${durationSeconds}s).`,
      details: {
        sessionId: session.sessionId,
        admin_id: session.realAdmin.id,
        admin_name: session.realAdmin.name,
        target_user_id: session.targetUser.id,
        target_user_name: session.targetUser.name,
        started_at: session.startedAt,
        ended_at: endedAt.toISOString(),
        duration_seconds: durationSeconds,
        duration_minutes: parseFloat(durationMinutes)
      }
    });

    // Transmite aviso de término em tempo real para o usuário acessado
    try {
      const payload = {
        targetUserId: session.targetUser.id,
        targetUserName: session.targetUser.name,
        targetUsername: session.targetUser.username,
        targetEmail: session.targetUser.email || '',
        adminName: session.realAdmin.name,
        sessionId: session.sessionId
      };

      const ch1 = supabase.channel('global_events');
      if (ch1.state === 'joined') {
        ch1.send({ type: 'broadcast', event: 'impersonation-ended', payload });
      } else {
        ch1.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            ch1.send({ type: 'broadcast', event: 'impersonation-ended', payload });
          }
        });
      }

      const ch2 = supabase.channel('user_impersonation_alerts');
      if (ch2.state === 'joined') {
        ch2.send({ type: 'broadcast', event: 'impersonation-ended', payload });
      } else {
        ch2.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            ch2.send({ type: 'broadcast', event: 'impersonation-ended', payload });
          }
        });
      }
    } catch (broadcastErr) {
      console.warn('[Impersonation] Erro ao transmitir broadcast de término:', broadcastErr);
    }

    this.clearSession();
    console.info(`[Impersonation] Sessão encerrada. Duração: ${durationMinutes} minutos.`);
    return { success: true, durationSeconds };
  },

  /**
   * Limpa a chave do sessionStorage.
   */
  clearSession() {
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(STORAGE_KEY);
    }
  }
};
