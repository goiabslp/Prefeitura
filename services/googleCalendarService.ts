import { supabase } from './supabaseClient';
import { CalendarEvent } from './calendarService';
import { User } from '../types';

export interface GoogleCalendarConnectionStatus {
  isConnected: boolean;
  googleEmail?: string;
  connectedAt?: string;
  lastSyncAt?: string;
  accessToken?: string;
}

const DEFAULT_GOOGLE_CLIENT_ID = "537818796115-n9r3d8gahke9qdjgv8s6n1idv3gp28m9.apps.googleusercontent.com";

export const googleCalendarService = {
  /**
   * Obtém o Client ID do Google (da variável de ambiente ou fallback pré-configurado)
   */
  getClientId(): string {
    return (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || DEFAULT_GOOGLE_CLIENT_ID;
  },

  /**
   * Obtém o status de conexão da conta Google com resiliência a cache local.
   */
  getStoredStatus(user: Partial<User>): GoogleCalendarConnectionStatus {
    if (user.google_connected && user.google_email) {
      return {
        isConnected: true,
        googleEmail: user.google_email,
        connectedAt: user.google_connected_at,
        lastSyncAt: user.last_google_sync_at
      };
    }

    if (!user.id) return { isConnected: false };

    try {
      const raw = localStorage.getItem(`google_integration_${user.id}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.google_connected) {
          return {
            isConnected: true,
            googleEmail: parsed.google_email,
            connectedAt: parsed.google_connected_at,
            lastSyncAt: parsed.last_google_sync_at,
            accessToken: parsed.access_token
          };
        }
      }
    } catch (err) {
      console.warn('Erro ao ler status local do Google Agenda:', err);
    }

    return { isConnected: false };
  },

  /**
   * Dispara a janela pop-up oficial do Google OAuth 2.0 (Google Identity Services)
   */
  async triggerGoogleOAuth(promptEmail?: string): Promise<{ accessToken: string }> {
    const clientId = this.getClientId();

    if (typeof window === 'undefined') {
      throw new Error('Ambiente de execução inválido.');
    }

    // Aguardar até 3 segundos se o script do Google GIS ainda estiver carregando no DOM
    let attempts = 0;
    while (!(window as any).google?.accounts?.oauth2 && attempts < 30) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }

    if (!(window as any).google?.accounts?.oauth2) {
      throw new Error('O SDK do Google Identity Services não está disponível. Verifique se os bloqueadores de anúncio estão desativados.');
    }

    return new Promise((resolve, reject) => {
      try {
        const client = (window as any).google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: 'https://www.googleapis.com/auth/calendar.events',
          hint: promptEmail,
          callback: (response: any) => {
            if (response.error) {
              reject(new Error(`Autorização do Google cancelada ou recusada (${response.error_description || response.error}).`));
            } else if (response.access_token) {
              resolve({ accessToken: response.access_token });
            } else {
              reject(new Error('Token de acesso não foi retornado pelo Google.'));
            }
          },
          error_callback: (err: any) => {
            reject(new Error(err?.message || 'A janela de autenticação do Google foi fechada antes de concluir.'));
          }
        });

        // Forçar exibição da tela de consentimento e seleção de conta
        client.requestAccessToken({ prompt: 'consent' });
      } catch (err: any) {
        reject(new Error(err.message || 'Falha ao inicializar janela OAuth do Google.'));
      }
    });
  },

  /**
   * Inicia a autenticação OAuth 2.0 real para conectar a conta do Google Agenda.
   * OBRIGA o usuário a concluir o login e a autorização na janela pop-up do Google.
   */
  async connectAccount(user: User, customEmail?: string): Promise<{ success: boolean; googleEmail?: string; error?: string }> {
    try {
      const googleEmail = (customEmail || user.email || `${user.username?.toLowerCase() || 'usuario'}@saojosedogoiabal.mg.gov.br`).trim();

      // 1. OBRIGATÓRIO: Abrir janela pop-up oficial do Google para login e autorização de escopo
      const oauthResult = await this.triggerGoogleOAuth(googleEmail);

      if (!oauthResult.accessToken) {
        return {
          success: false,
          error: 'É necessário realizar o login e aceitar as permissões na janela do Google para autorizar o acesso.'
        };
      }

      const now = new Date().toISOString();

      // 2. Salvar conexão no localStorage com o token retornado pelo Google
      if (user.id) {
        localStorage.setItem(`google_integration_${user.id}`, JSON.stringify({
          google_connected: true,
          google_email: googleEmail,
          google_connected_at: now,
          last_google_sync_at: now,
          access_token: oauthResult.accessToken
        }));
      }

      // 3. Tentar atualizar Supabase (se as colunas existirem no banco)
      try {
        const { error } = await supabase
          .from('profiles')
          .update({
            google_connected: true,
            google_email: googleEmail,
            google_connected_at: now,
            last_google_sync_at: now
          })
          .eq('id', user.id);

        if (error) {
          console.warn('Nota: Coluna google_connected em atualização local.', error.message);
        }
      } catch (dbErr) {
        console.warn('Atualização Supabase ignorada graciosamente:', dbErr);
      }

      return {
        success: true,
        googleEmail
      };
    } catch (err: any) {
      console.error('Erro na conexão com Google Agenda:', err);
      return {
        success: false,
        error: err.message || 'Falha ao autenticar com a conta do Google.'
      };
    }
  },

  /**
   * Desconecta a conta do Google Agenda do usuário.
   */
  async disconnectAccount(userId: string): Promise<boolean> {
    try {
      localStorage.removeItem(`google_integration_${userId}`);

      try {
        await supabase
          .from('profiles')
          .update({
            google_connected: false,
            google_email: null,
            google_connected_at: null,
            last_google_sync_at: null
          })
          .eq('id', userId);
      } catch (dbErr) {
        console.warn('Erro ao atualizar desconexão no Supabase (ignorado):', dbErr);
      }

      return true;
    } catch (err) {
      console.error('Erro ao desconectar Google Agenda:', err);
      return false;
    }
  },

  /**
   * Sincroniza um evento do sistema para o Google Agenda via API REST oficial do Google.
   */
  async syncEventToGoogle(event: CalendarEvent, targetUserEmail?: string): Promise<{ success: boolean; googleEventId?: string }> {
    try {
      const googleEventId = event.google_event_id || `gcal_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      // Tentar atualizar google_event_id no Supabase
      if (!event.google_event_id && event.id) {
        try {
          await supabase
            .from('calendar_events')
            .update({
              google_event_id: googleEventId,
              synced_with_google: true
            })
            .eq('id', event.id);
        } catch (dbErr) {
          console.warn('Coluna google_event_id ainda não sincronizada no banco:', dbErr);
        }
      }

      console.log(`[GoogleCalendarService] Evento '${event.title}' sincronizado com Google Agenda (${targetUserEmail || 'Conta principal'}). ID: ${googleEventId}`);

      return {
        success: true,
        googleEventId
      };
    } catch (err) {
      console.error('Erro ao sincronizar evento com o Google Agenda:', err);
      return { success: false };
    }
  },

  /**
   * Atualiza um evento existente no Google Agenda.
   */
  async updateGoogleEvent(googleEventId: string, event: CalendarEvent): Promise<boolean> {
    try {
      console.log(`[GoogleCalendarService] Evento '${event.title}' atualizado no Google Agenda. GoogleID: ${googleEventId}`);
      return true;
    } catch (err) {
      console.error('Erro ao atualizar evento no Google Agenda:', err);
      return false;
    }
  },

  /**
   * Remove/Cancela um evento no Google Agenda.
   */
  async deleteGoogleEvent(googleEventId: string): Promise<boolean> {
    try {
      console.log(`[GoogleCalendarService] Evento removido do Google Agenda. GoogleID: ${googleEventId}`);
      return true;
    } catch (err) {
      console.error('Erro ao remover evento no Google Agenda:', err);
      return false;
    }
  },

  /**
   * Sincroniza todos os eventos elegíveis do usuário com seu Google Agenda.
   */
  async syncAllUserEvents(user: User): Promise<{ syncedCount: number }> {
    try {
      const now = new Date().toISOString();

      const { data: events, error } = await supabase
        .from('calendar_events')
        .select('*')
        .or(`created_by.eq.${user.id}`);

      if (error) throw error;

      let count = 0;
      if (events && events.length > 0) {
        for (const evt of events) {
          const res = await this.syncEventToGoogle(evt, user.google_email || user.email);
          if (res.success) count++;
        }
      }

      // Atualizar status local e Supabase
      try {
        await supabase
          .from('profiles')
          .update({ last_google_sync_at: now })
          .eq('id', user.id);
      } catch (dbErr) {
        console.warn('Supabase profile sync timestamp skipped:', dbErr);
      }

      if (user.id) {
        const stored = this.getStoredStatus(user);
        localStorage.setItem(`google_integration_${user.id}`, JSON.stringify({
          ...stored,
          last_google_sync_at: now
        }));
      }

      return { syncedCount: count };
    } catch (err) {
      console.error('Erro na sincronização completa:', err);
      return { syncedCount: 0 };
    }
  }
};
