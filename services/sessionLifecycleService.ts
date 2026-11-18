/**
 * ============================================================================
 * SERVIÇO DE CICLO DE VIDA DA SESSÃO — LIMITE ABSOLUTO DE 4 HORAS (240 MINUTOS)
 * ============================================================================
 * 
 * Regras Obrigatórias do Sistema:
 * 1. A sessão dura no máximo 4 horas (14.400.000 ms) a partir do login bem-sucedido.
 * 2. O prazo é absoluto: não é prolongado por atividade, requisições ou navegação.
 * 3. Atualizações de página (F5) NÃO reiniciam a contagem.
 * 4. A renovação de tokens (refresh token do Supabase) NÃO prolonga esse limite.
 * 5. Após 4 horas, a sessão é invalidada no frontend e backend, deslogando no Supabase.
 * 6. Sincronização multi-abas em tempo real (BroadcastChannel e storage events).
 * 7. Mensagem oficial ao expirar: "Sua sessão expirou após 4 horas. Faça login novamente para continuar."
 */

export const SESSION_MAX_DURATION_HOURS = 4;
export const SESSION_MAX_DURATION_MS = SESSION_MAX_DURATION_HOURS * 60 * 60 * 1000; // 14.400.000 ms (240 minutos)
export const SESSION_WARNING_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutos antes para aviso antecipado

export const SESSION_EXPIRED_OFFICIAL_MESSAGE = 'Sua sessão expirou após 4 horas. Faça login novamente para continuar.';

const STORAGE_KEYS = {
  STARTED_AT: 'prefeitura_session_started_at',
  EXPIRES_AT: 'prefeitura_session_expires_at',
  USER_ID: 'prefeitura_session_user_id',
  SERVER_OFFSET: 'prefeitura_session_server_offset_ms',
  EXPIRED_MSG: 'prefeitura_session_expired_message',
  CHECKSUM: 'prefeitura_session_checksum',
  SYNC_EVENT: 'prefeitura_session_sync_broadcast'
};

const BROADCAST_CHANNEL_NAME = 'prefeitura_session_lifecycle_channel';

// Gerador de Checksum simples de integridade para evitar adulterações no localStorage
function generateSessionChecksum(userId: string, startedAt: number, expiresAt: number): string {
  const payload = `${userId}:${startedAt}:${expiresAt}:prefeitura_sec_salt_2026`;
  let hash = 0;
  for (let i = 0; i < payload.length; i++) {
    const char = payload.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

// Tipos de Eventos de Sincronização entre Abas
export type SessionSyncEvent = 
  | { type: 'SESSION_STARTED'; userId: string; startedAt: number; expiresAt: number }
  | { type: 'SESSION_EXPIRED'; reason: string }
  | { type: 'SESSION_LOGOUT' };

class SessionLifecycleService {
  private serverOffsetMs: number = 0;
  private broadcastChannel: BroadcastChannel | null = null;
  private expiredListeners: Set<(reason: string) => void> = new Set();
  private logoutListeners: Set<() => void> = new Set();
  private startedListeners: Set<(userId: string) => void> = new Set();
  private lastLogoutNotifiedAt: number = 0;
  private lastExpiredNotifiedAt: number = 0;

  constructor() {
    this.initServerOffset();
    this.initBroadcastChannel();
    this.initStorageListener();
  }

  /**
   * Recupera o desvio de relógio entre cliente e servidor se já calculado
   */
  private initServerOffset() {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.SERVER_OFFSET);
      if (stored) {
        const val = parseInt(stored, 10);
        if (!isNaN(val)) this.serverOffsetMs = val;
      }
    } catch (e) {
      // Ignora erro de acesso a storage
    }
  }

  /**
   * Sincroniza a hora do cliente com o relógio oficial do servidor Supabase (via header Date de requisições)
   */
  public syncServerTime(serverDateHeader: string | null | undefined): void {
    if (!serverDateHeader || typeof window === 'undefined') return;
    try {
      const serverTime = new Date(serverDateHeader).getTime();
      if (!isNaN(serverTime) && serverTime > 0) {
        const localTime = Date.now();
        const offset = serverTime - localTime;
        // Atualiza apenas se a discrepância for plausível (< 24 horas)
        if (Math.abs(offset) < 24 * 60 * 60 * 1000) {
          this.serverOffsetMs = offset;
          try {
            localStorage.setItem(STORAGE_KEYS.SERVER_OFFSET, offset.toString());
          } catch {}
        }
      }
    } catch {}
  }

  /**
   * Retorna a hora atual sincronizada com o relógio do servidor
   */
  public getCurrentTime(): number {
    return Date.now() + this.serverOffsetMs;
  }

  /**
   * Inicializa o canal BroadcastChannel para sincronia instantânea entre abas
   */
  private initBroadcastChannel() {
    if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return;
    try {
      this.broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      this.broadcastChannel.onmessage = (event) => {
        const data = event.data as SessionSyncEvent;
        this.handleIncomingSyncEvent(data);
      };
    } catch (e) {
      console.warn('[SessionLifecycle] BroadcastChannel não suportado neste ambiente.');
    }
  }

  /**
   * Listener de fallback via evento storage (compatibilidade total e cross-origin window tabs)
   */
  private initStorageListener() {
    if (typeof window === 'undefined') return;
    window.addEventListener('storage', (e) => {
      if (e.key === STORAGE_KEYS.SYNC_EVENT && e.newValue) {
        try {
          const data = JSON.parse(e.newValue) as SessionSyncEvent;
          this.handleIncomingSyncEvent(data);
        } catch {}
      } else if (e.key === STORAGE_KEYS.STARTED_AT && !e.newValue) {
        // Se a chave foi removida em outra aba, dispara encerramento
        this.notifyLogoutListeners();
      }
    });
  }

  /**
   * Trata evento de sincronização recebido de outra aba
   */
  private handleIncomingSyncEvent(event: SessionSyncEvent) {
    if (!event) return;
    if (event.type === 'SESSION_EXPIRED') {
      this.notifyExpiredListeners(event.reason);
    } else if (event.type === 'SESSION_LOGOUT') {
      this.notifyLogoutListeners();
    } else if (event.type === 'SESSION_STARTED') {
      this.startedListeners.forEach(listener => listener(event.userId));
    }
  }

  /**
   * Emite evento de sincronização para todas as outras abas
   */
  private broadcastSyncEvent(event: SessionSyncEvent) {
    if (typeof window === 'undefined') return;
    try {
      if (this.broadcastChannel) {
        this.broadcastChannel.postMessage(event);
      }
      localStorage.setItem(STORAGE_KEYS.SYNC_EVENT, JSON.stringify({ ...event, _t: Date.now() }));
    } catch {}
  }

  /**
   * Inicia um novo ciclo de sessão de 4 horas a partir de um login com sucesso.
   * Chamado estritamente no momento do login explícito (não em refresh de token!).
   */
  public startSession(userId: string): void {
    if (typeof window === 'undefined') return;
    const now = this.getCurrentTime();
    const expiresAt = now + SESSION_MAX_DURATION_MS;
    const checksum = generateSessionChecksum(userId, now, expiresAt);

    try {
      localStorage.setItem(STORAGE_KEYS.STARTED_AT, now.toString());
      localStorage.setItem(STORAGE_KEYS.EXPIRES_AT, expiresAt.toString());
      localStorage.setItem(STORAGE_KEYS.USER_ID, userId);
      localStorage.setItem(STORAGE_KEYS.CHECKSUM, checksum);
      localStorage.removeItem(STORAGE_KEYS.EXPIRED_MSG); // Limpa mensagens anteriores
    } catch (e) {
      console.error('[SessionLifecycle] Erro ao gravar dados da nova sessão no localStorage:', e);
    }

    this.broadcastSyncEvent({
      type: 'SESSION_STARTED',
      userId,
      startedAt: now,
      expiresAt
    });

    console.log(`[SessionLifecycle] Nova sessão iniciada para o usuário ${userId}. Duração máxima: 4 horas (expira em ${new Date(expiresAt).toLocaleTimeString()}).`);
  }

  /**
   * Verifica rigorosamente se a sessão atual é válida e está dentro do limite de 4 horas.
   */
  public isSessionValid(expectedUserId?: string): {
    isValid: boolean;
    reason?: 'missing_session' | 'user_mismatch' | 'invalid_checksum' | 'expired_4h';
    elapsedMs: number;
    remainingMs: number;
    startedAt: number | null;
    expiresAt: number | null;
  } {
    if (typeof window === 'undefined') {
      return { isValid: false, reason: 'missing_session', elapsedMs: 0, remainingMs: 0, startedAt: null, expiresAt: null };
    }

    try {
      const startedStr = localStorage.getItem(STORAGE_KEYS.STARTED_AT);
      const expiresStr = localStorage.getItem(STORAGE_KEYS.EXPIRES_AT);
      const userId = localStorage.getItem(STORAGE_KEYS.USER_ID);
      const storedChecksum = localStorage.getItem(STORAGE_KEYS.CHECKSUM);

      if (!startedStr || !expiresStr || !userId) {
        return { isValid: false, reason: 'missing_session', elapsedMs: 0, remainingMs: 0, startedAt: null, expiresAt: null };
      }

      if (expectedUserId && expectedUserId !== userId) {
        return { isValid: false, reason: 'user_mismatch', elapsedMs: 0, remainingMs: 0, startedAt: null, expiresAt: null };
      }

      const startedAt = parseInt(startedStr, 10);
      const expiresAt = parseInt(expiresStr, 10);

      if (isNaN(startedAt) || isNaN(expiresAt)) {
        return { isValid: false, reason: 'missing_session', elapsedMs: 0, remainingMs: 0, startedAt: null, expiresAt: null };
      }

      // Validação de Checksum
      const expectedChecksum = generateSessionChecksum(userId, startedAt, expiresAt);
      if (storedChecksum !== expectedChecksum) {
        console.warn('[SessionLifecycle] Checksum de integridade da sessão inválido!');
        return { isValid: false, reason: 'invalid_checksum', elapsedMs: 0, remainingMs: 0, startedAt, expiresAt };
      }

      const now = this.getCurrentTime();
      const elapsedMs = now - startedAt;
      const remainingMs = expiresAt - now;

      // Se passou de 4 horas (ou relógio adulterado retroativamente para antes do início)
      if (remainingMs <= 0 || elapsedMs >= SESSION_MAX_DURATION_MS || elapsedMs < -60000) {
        return {
          isValid: false,
          reason: 'expired_4h',
          elapsedMs: Math.max(0, elapsedMs),
          remainingMs: 0,
          startedAt,
          expiresAt
        };
      }

      return {
        isValid: true,
        elapsedMs,
        remainingMs,
        startedAt,
        expiresAt
      };
    } catch (e) {
      return { isValid: false, reason: 'missing_session', elapsedMs: 0, remainingMs: 0, startedAt: null, expiresAt: null };
    }
  }

  /**
   * Retorna os milissegundos restantes da sessão (0 se expirada ou ausente)
   */
  public getRemainingMs(): number {
    const status = this.isSessionValid();
    return status.isValid ? status.remainingMs : 0;
  }

  /**
   * Verifica se a sessão está no período de aviso antecipado (<= 5 minutos restantes)
   */
  public isNearExpiration(): { isNear: boolean; remainingMinutes: number } {
    const status = this.isSessionValid();
    if (!status.isValid) return { isNear: false, remainingMinutes: 0 };
    const isNear = status.remainingMs > 0 && status.remainingMs <= SESSION_WARNING_THRESHOLD_MS;
    const remainingMinutes = Math.max(1, Math.ceil(status.remainingMs / (60 * 1000)));
    return { isNear, remainingMinutes };
  }

  /**
   * Invalida a sessão por expiração (atingiu o limite de 4 horas)
   */
  public expireSession(
    reason: string = SESSION_EXPIRED_OFFICIAL_MESSAGE,
    options?: { broadcast?: boolean; notifyLocal?: boolean }
  ): void {
    if (typeof window === 'undefined') return;

    const now = Date.now();
    const shouldBroadcast = options?.broadcast !== false;
    const shouldNotifyLocal = options?.notifyLocal !== false;

    try {
      localStorage.setItem(STORAGE_KEYS.EXPIRED_MSG, reason);
      localStorage.removeItem(STORAGE_KEYS.STARTED_AT);
      localStorage.removeItem(STORAGE_KEYS.EXPIRES_AT);
      localStorage.removeItem(STORAGE_KEYS.USER_ID);
      localStorage.removeItem(STORAGE_KEYS.CHECKSUM);

      // Limpa os tokens do Supabase no storage local para evitar qualquer ressuscitação por refresh token antigo
      this.clearSupabaseAuthStorage();
    } catch (e) {}

    // Evita reentrância / rajadas repetidas em janela curta
    if (now - this.lastExpiredNotifiedAt < 1500) {
      return;
    }
    this.lastExpiredNotifiedAt = now;

    if (shouldBroadcast) {
      this.broadcastSyncEvent({ type: 'SESSION_EXPIRED', reason });
    }
    if (shouldNotifyLocal) {
      this.notifyExpiredListeners(reason, true);
    }
  }

  /**
   * Encerra a sessão normalmente (logout manual do usuário).
   * Por padrão, propaga o encerramento apenas para OUTRAS abas (broadcast: true)
   * e NÃO dispara notifyLogoutListeners na própria aba (evitando loop infinito com SIGNED_OUT).
   */
  public clearSession(options?: { broadcast?: boolean; notifyLocal?: boolean }): void {
    if (typeof window === 'undefined') return;

    const shouldBroadcast = options?.broadcast !== false;
    const shouldNotifyLocal = options?.notifyLocal === true;

    let hadActiveSession = false;
    try {
      hadActiveSession = Boolean(
        localStorage.getItem(STORAGE_KEYS.STARTED_AT) ||
        localStorage.getItem(STORAGE_KEYS.USER_ID)
      );

      localStorage.removeItem(STORAGE_KEYS.STARTED_AT);
      localStorage.removeItem(STORAGE_KEYS.EXPIRES_AT);
      localStorage.removeItem(STORAGE_KEYS.USER_ID);
      localStorage.removeItem(STORAGE_KEYS.CHECKSUM);
      localStorage.removeItem(STORAGE_KEYS.EXPIRED_MSG);

      this.clearSupabaseAuthStorage();
    } catch (e) {}

    // Só envia evento para outras abas se havia sessão ativa a encerrar
    if (shouldBroadcast && hadActiveSession) {
      this.broadcastSyncEvent({ type: 'SESSION_LOGOUT' });
    }
    if (shouldNotifyLocal) {
      this.notifyLogoutListeners();
    }
  }

  /**
   * Limpa rigorosamente chaves sb-*-auth-token do localStorage e sessionStorage
   */
  public clearSupabaseAuthStorage(): void {
    if (typeof window === 'undefined') return;
    try {
      const clearTokensFrom = (storage: Storage) => {
        const keysToRemove: string[] = [];
        for (let i = 0; i < storage.length; i++) {
          const key = storage.key(i);
          if (key && (key.startsWith('sb-') || key.includes('auth-token') || key.includes('supabase.auth'))) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(k => storage.removeItem(k));
      };

      clearTokensFrom(window.localStorage);
      clearTokensFrom(window.sessionStorage);
    } catch {}
  }

  /**
   * Consome e apaga a mensagem de expiração da sessão (para exibir na tela de login uma única vez)
   */
  public consumeSessionExpiredMessage(): string | null {
    if (typeof window === 'undefined') return null;
    try {
      const msg = localStorage.getItem(STORAGE_KEYS.EXPIRED_MSG);
      if (msg) {
        localStorage.removeItem(STORAGE_KEYS.EXPIRED_MSG);
        return msg;
      }
    } catch {}
    return null;
  }

  /**
   * Inscrição para receber notificação quando a sessão expirar
   */
  public onSessionExpired(callback: (reason: string) => void): () => void {
    this.expiredListeners.add(callback);
    return () => this.expiredListeners.delete(callback);
  }

  /**
   * Inscrição para receber notificação de logout sincronizado
   */
  public onSessionLogout(callback: () => void): () => void {
    this.logoutListeners.add(callback);
    return () => this.logoutListeners.delete(callback);
  }

  private notifyExpiredListeners(reason: string, skipDebounce = false) {
    const now = Date.now();
    if (!skipDebounce) {
      if (now - this.lastExpiredNotifiedAt < 1500) return;
      this.lastExpiredNotifiedAt = now;
    }
    this.expiredListeners.forEach(listener => {
      try { listener(reason); } catch (e) { console.error(e); }
    });
  }

  private notifyLogoutListeners() {
    const now = Date.now();
    // Deduplica eventos duplicados (BroadcastChannel + storage event simultâneos ou reentrância)
    if (now - this.lastLogoutNotifiedAt < 1500) return;
    this.lastLogoutNotifiedAt = now;
    this.logoutListeners.forEach(listener => {
      try { listener(); } catch (e) { console.error(e); }
    });
  }
}

export const sessionLifecycleService = new SessionLifecycleService();
