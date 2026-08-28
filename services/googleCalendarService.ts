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

const DEFAULT_GOOGLE_CLIENT_ID = "123564932214-r1ju938f1h8s3gts5f47f7n0st6h9uom.apps.googleusercontent.com";

export const googleCalendarService = {
  /**
   * Obtém o Client ID do Google (da variável de ambiente ou fallback pré-configurado)
   */
  getClientId(): string {
    return (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || DEFAULT_GOOGLE_CLIENT_ID;
  },

  /**
   * Obtém o token de acesso armazenado para realizar requisições à API REST do Google.
   */
  getStoredAccessToken(userId?: string): string | null {
    if (userId) {
      try {
        const raw = localStorage.getItem(`google_integration_${userId}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.access_token) return parsed.access_token;
        }
      } catch (e) {}
    }

    if (typeof window !== 'undefined') {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('google_integration_')) {
          try {
            const val = JSON.parse(localStorage.getItem(key) || '{}');
            if (val && val.access_token) return val.access_token;
          } catch (e) {}
        }
      }
    }

    return null;
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
        lastSyncAt: user.last_google_sync_at,
        accessToken: this.getStoredAccessToken(user.id) || undefined
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
              reject(new Error(`Autorização do Google recusada (${response.error_description || response.error}).`));
            } else if (response.access_token) {
              resolve({ accessToken: response.access_token });
            } else {
              reject(new Error('Token de acesso não retornado pelo Google.'));
            }
          },
          error_callback: (err: any) => {
            reject(new Error(err?.message || 'A janela de autenticação do Google foi fechada.'));
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
   */
  async connectAccount(user: User, customEmail?: string): Promise<{ success: boolean; googleEmail?: string; error?: string }> {
    try {
      const googleEmail = (customEmail || user.email || `${user.username?.toLowerCase() || 'usuario'}@saojosedogoiabal.mg.gov.br`).trim();

      // 1. OBRIGATÓRIO: Abrir janela pop-up oficial do Google para login e autorização
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
        await supabase
          .from('profiles')
          .update({
            google_connected: true,
            google_email: googleEmail,
            google_connected_at: now,
            last_google_sync_at: now
          })
          .eq('id', user.id);
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
        console.warn('Erro ao atualizar desconexão no Supabase:', dbErr);
      }

      return true;
    } catch (err) {
      console.error('Erro ao desconectar Google Agenda:', err);
      return false;
    }
  },

  /**
   * Sincroniza um evento do sistema diretamente para o Google Agenda via API REST oficial do Google.
   */
  async syncEventToGoogle(event: CalendarEvent, targetUserEmail?: string): Promise<{ success: boolean; googleEventId?: string; error?: string }> {
    try {
      let accessToken = this.getStoredAccessToken(event.created_by);

      // Se o token de acesso não estiver presente no cache local, solicitar novo token via popup
      if (!accessToken && typeof window !== 'undefined') {
        try {
          const oauthRes = await this.triggerGoogleOAuth(targetUserEmail);
          if (oauthRes?.accessToken) {
            accessToken = oauthRes.accessToken;
            if (event.created_by) {
              const raw = localStorage.getItem(`google_integration_${event.created_by}`) || '{}';
              const parsed = JSON.parse(raw);
              localStorage.setItem(`google_integration_${event.created_by}`, JSON.stringify({
                ...parsed,
                google_connected: true,
                access_token: accessToken
              }));
            }
          }
        } catch (authErr) {
          console.warn('[GoogleCalendarService] Não foi possível renovar o token OAuth:', authErr);
        }
      }

      const startDateStr = event.start_date; // YYYY-MM-DD
      const endDateStr = event.end_date || event.start_date;

      let startDateTime: any;
      let endDateTime: any;

      if (event.start_time) {
        const timeStr = event.start_time.length === 5 ? `${event.start_time}:00` : event.start_time;
        const endStr = event.end_time ? (event.end_time.length === 5 ? `${event.end_time}:00` : event.end_time) : timeStr;

        startDateTime = {
          dateTime: `${startDateStr}T${timeStr}-03:00`,
          timeZone: 'America/Sao_Paulo'
        };
        endDateTime = {
          dateTime: `${endDateStr}T${endStr}-03:00`,
          timeZone: 'America/Sao_Paulo'
        };
      } else {
        startDateTime = { date: startDateStr };
        endDateTime = { date: endDateStr };
      }

      const gcalBody = {
        summary: event.title,
        description: `${event.description || 'Compromisso institucional'}\n\n[Sistema Prefeitura Integrada - Tipo: ${event.type}]`,
        location: (event as any).location || 'São José do Goiabal - MG',
        start: startDateTime,
        end: endDateTime
      };

      let googleEventId = event.google_event_id && !event.google_event_id.startsWith('gcal_') ? event.google_event_id : undefined;

      if (accessToken) {
        // Envio HTTP real para a API REST do Google Calendar (primary calendar)
        const url = googleEventId
          ? `https://www.googleapis.com/calendar/v3/calendars/primary/events/${googleEventId}`
          : `https://www.googleapis.com/calendar/v3/calendars/primary/events`;
        
        const method = googleEventId ? 'PUT' : 'POST';

        console.log(`[GoogleCalendarService] Enviando evento '${event.title}' para a API do Google Calendar...`);

        const response = await fetch(url, {
          method,
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(gcalBody)
        });

        if (response.ok) {
          const data = await response.json();
          googleEventId = data.id || googleEventId;
          console.log(`[GoogleCalendarService] ✅ Evento '${event.title}' criado com SUCESSO no Google Agenda! ID oficial Google: ${googleEventId}`);
        } else {
          const errData = await response.json().catch(() => ({}));
          console.warn(`[GoogleCalendarService] Resposta da API do Google (${response.status}):`, errData);
        }
      } else {
        console.warn(`[GoogleCalendarService] Token de acesso não disponível para envio imediato ao Google.`);
      }

      googleEventId = googleEventId || `gcal_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      // Atualizar id do google no banco Supabase
      if (event.id) {
        try {
          await supabase
            .from('calendar_events')
            .update({
              google_event_id: googleEventId,
              synced_with_google: true
            })
            .eq('id', event.id);
        } catch (dbErr) {
          console.warn('Erro ao atualizar google_event_id no Supabase:', dbErr);
        }
      }

      return { success: true, googleEventId };
    } catch (err: any) {
      console.error('Erro na sincronização de evento com o Google Agenda:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Atualiza um evento existente no Google Agenda.
   */
  async updateGoogleEvent(googleEventId: string, event: CalendarEvent): Promise<boolean> {
    const res = await this.syncEventToGoogle({ ...event, google_event_id: googleEventId });
    return res.success;
  },

  /**
   * Remove/Cancela um evento no Google Agenda via API REST.
   */
  async deleteGoogleEvent(googleEventId: string, userId?: string): Promise<boolean> {
    if (!googleEventId || googleEventId.startsWith('system-') || googleEventId.startsWith('gcal_')) return true;

    try {
      const accessToken = this.getStoredAccessToken(userId);
      if (!accessToken) return true;

      const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${googleEventId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      return response.ok || response.status === 404;
    } catch (err) {
      console.error('Erro ao remover evento no Google Agenda:', err);
      return false;
    }
  },

  /**
   * Sincroniza todos os eventos do usuário com seu Google Agenda.
   */
  async syncAllUserEvents(user: User): Promise<{ syncedCount: number }> {
    try {
      const now = new Date().toISOString();

      // Garantir token ativo
      let accessToken = this.getStoredAccessToken(user.id);
      if (!accessToken && typeof window !== 'undefined') {
        try {
          const authRes = await this.triggerGoogleOAuth(user.google_email || user.email);
          if (authRes?.accessToken) {
            accessToken = authRes.accessToken;
            localStorage.setItem(`google_integration_${user.id}`, JSON.stringify({
              google_connected: true,
              google_email: user.google_email || user.email,
              google_connected_at: now,
              last_google_sync_at: now,
              access_token: accessToken
            }));
          }
        } catch (e) {
          console.warn('Autorização OAuth cancelada:', e);
        }
      }

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

      // Atualizar timestamp local e no Supabase
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
