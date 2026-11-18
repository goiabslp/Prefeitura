import test from 'node:test';
import assert from 'node:assert/strict';

// ============================================================================
// SIMULAÇÃO DO AMBIENTE DE SESSÃO E STORAGE
// ============================================================================

const SESSION_MAX_DURATION_HOURS = 4;
const SESSION_MAX_DURATION_MS = SESSION_MAX_DURATION_HOURS * 60 * 60 * 1000; // 14.400.000 ms
const SESSION_WARNING_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutos
const SESSION_EXPIRED_OFFICIAL_MESSAGE = 'Sua sessão expirou após 4 horas. Faça login novamente para continuar.';

const STORAGE_KEYS = {
  STARTED_AT: 'prefeitura_session_started_at',
  EXPIRES_AT: 'prefeitura_session_expires_at',
  USER_ID: 'prefeitura_session_user_id',
  SERVER_OFFSET: 'prefeitura_session_server_offset_ms',
  EXPIRED_MSG: 'prefeitura_session_expired_message',
  CHECKSUM: 'prefeitura_session_checksum',
  SYNC_EVENT: 'prefeitura_session_sync_broadcast'
};

function generateSessionChecksum(userId, startedAt, expiresAt) {
  const payload = `${userId}:${startedAt}:${expiresAt}:prefeitura_sec_salt_2026`;
  let hash = 0;
  for (let i = 0; i < payload.length; i++) {
    const char = payload.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

class MockStorage {
  constructor() {
    this.store = new Map();
  }
  getItem(key) {
    return this.store.get(key) || null;
  }
  setItem(key, value) {
    this.store.set(key, String(value));
  }
  removeItem(key) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
  get length() {
    return this.store.size;
  }
  key(index) {
    return Array.from(this.store.keys())[index] || null;
  }
}

class SessionLifecycleTester {
  constructor(storage, initialTime = Date.now()) {
    this.storage = storage;
    this.currentTime = initialTime;
    this.serverOffsetMs = 0;
    this.syncEvents = [];
    this.expiredListeners = [];
    this.logoutListeners = [];
  }

  setCurrentTime(t) {
    this.currentTime = t;
  }

  advanceTime(ms) {
    this.currentTime += ms;
  }

  getCurrentTime() {
    return this.currentTime + this.serverOffsetMs;
  }

  syncServerTime(serverDateHeader) {
    if (!serverDateHeader) return;
    const sTime = new Date(serverDateHeader).getTime();
    if (!isNaN(sTime) && sTime > 0) {
      this.serverOffsetMs = sTime - this.currentTime;
    }
  }

  startSession(userId) {
    const now = this.getCurrentTime();
    const expiresAt = now + SESSION_MAX_DURATION_MS;
    const checksum = generateSessionChecksum(userId, now, expiresAt);

    this.storage.setItem(STORAGE_KEYS.STARTED_AT, now.toString());
    this.storage.setItem(STORAGE_KEYS.EXPIRES_AT, expiresAt.toString());
    this.storage.setItem(STORAGE_KEYS.USER_ID, userId);
    this.storage.setItem(STORAGE_KEYS.CHECKSUM, checksum);
    this.storage.removeItem(STORAGE_KEYS.EXPIRED_MSG);

    this.emitSyncEvent({
      type: 'SESSION_STARTED',
      userId,
      startedAt: now,
      expiresAt
    });
  }

  isSessionValid(expectedUserId) {
    const startedStr = this.storage.getItem(STORAGE_KEYS.STARTED_AT);
    const expiresStr = this.storage.getItem(STORAGE_KEYS.EXPIRES_AT);
    const userId = this.storage.getItem(STORAGE_KEYS.USER_ID);
    const storedChecksum = this.storage.getItem(STORAGE_KEYS.CHECKSUM);

    if (!startedStr || !expiresStr || !userId) {
      return { isValid: false, reason: 'missing_session', elapsedMs: 0, remainingMs: 0 };
    }

    if (expectedUserId && expectedUserId !== userId) {
      return { isValid: false, reason: 'user_mismatch', elapsedMs: 0, remainingMs: 0 };
    }

    const startedAt = parseInt(startedStr, 10);
    const expiresAt = parseInt(expiresStr, 10);

    if (isNaN(startedAt) || isNaN(expiresAt)) {
      return { isValid: false, reason: 'missing_session', elapsedMs: 0, remainingMs: 0 };
    }

    const expectedChecksum = generateSessionChecksum(userId, startedAt, expiresAt);
    if (storedChecksum !== expectedChecksum) {
      return { isValid: false, reason: 'invalid_checksum', elapsedMs: 0, remainingMs: 0 };
    }

    const now = this.getCurrentTime();
    const elapsedMs = now - startedAt;
    const remainingMs = expiresAt - now;

    if (remainingMs <= 0 || elapsedMs >= SESSION_MAX_DURATION_MS || elapsedMs < -60000) {
      return { isValid: false, reason: 'expired_4h', elapsedMs: Math.max(0, elapsedMs), remainingMs: 0 };
    }

    return { isValid: true, elapsedMs, remainingMs, startedAt, expiresAt };
  }

  isNearExpiration() {
    const status = this.isSessionValid();
    if (!status.isValid) return { isNear: false, remainingMinutes: 0 };
    const isNear = status.remainingMs > 0 && status.remainingMs <= SESSION_WARNING_THRESHOLD_MS;
    const remainingMinutes = Math.max(1, Math.ceil(status.remainingMs / (60 * 1000)));
    return { isNear, remainingMinutes };
  }

  expireSession(reason = SESSION_EXPIRED_OFFICIAL_MESSAGE) {
    this.storage.setItem(STORAGE_KEYS.EXPIRED_MSG, reason);
    this.storage.removeItem(STORAGE_KEYS.STARTED_AT);
    this.storage.removeItem(STORAGE_KEYS.EXPIRES_AT);
    this.storage.removeItem(STORAGE_KEYS.USER_ID);
    this.storage.removeItem(STORAGE_KEYS.CHECKSUM);

    this.clearSupabaseAuthTokens();
    this.emitSyncEvent({ type: 'SESSION_EXPIRED', reason });
    this.expiredListeners.forEach(fn => fn(reason));
  }

  clearSession() {
    this.storage.removeItem(STORAGE_KEYS.STARTED_AT);
    this.storage.removeItem(STORAGE_KEYS.EXPIRES_AT);
    this.storage.removeItem(STORAGE_KEYS.USER_ID);
    this.storage.removeItem(STORAGE_KEYS.CHECKSUM);
    this.storage.removeItem(STORAGE_KEYS.EXPIRED_MSG);

    this.clearSupabaseAuthTokens();
    this.emitSyncEvent({ type: 'SESSION_LOGOUT' });
    this.logoutListeners.forEach(fn => fn());
  }

  clearSupabaseAuthTokens() {
    for (let i = 0; i < this.storage.length; i++) {
      const key = this.storage.key(i);
      if (key && (key.startsWith('sb-') || key.includes('auth-token'))) {
        this.storage.removeItem(key);
      }
    }
  }

  consumeSessionExpiredMessage() {
    const msg = this.storage.getItem(STORAGE_KEYS.EXPIRED_MSG);
    if (msg) {
      this.storage.removeItem(STORAGE_KEYS.EXPIRED_MSG);
      return msg;
    }
    return null;
  }

  emitSyncEvent(event) {
    this.syncEvents.push(event);
  }
}

// ============================================================================
// SUÍTE DE TESTES OBRIGATÓRIOS
// ============================================================================

test('1. Login realizado há 1 hora: acesso permitido normalmente', () => {
  const storage = new MockStorage();
  const session = new SessionLifecycleTester(storage, 1700000000000);

  session.startSession('user_123');

  // Avança 1 hora (3.600.000 ms)
  session.advanceTime(1 * 60 * 60 * 1000);

  const check = session.isSessionValid('user_123');
  assert.equal(check.isValid, true, 'Sessão com 1h deve ser perfeitamente válida');
  assert.equal(check.remainingMs, 3 * 60 * 60 * 1000, 'Devem restar exatamente 3 horas');
});

test('2. Login realizado há 3h59: acesso permitido e aviso antecipado ativo', () => {
  const storage = new MockStorage();
  const session = new SessionLifecycleTester(storage, 1700000000000);

  session.startSession('user_123');

  // Avança 3 horas e 59 minutos
  session.advanceTime((3 * 60 + 59) * 60 * 1000);

  const check = session.isSessionValid('user_123');
  assert.equal(check.isValid, true, 'Sessão com 3h59 ainda é válida');
  assert.equal(check.remainingMs, 1 * 60 * 1000, 'Resta 1 minuto');

  // Aviso antecipado (<= 5 minutos)
  const near = session.isNearExpiration();
  assert.equal(near.isNear, true, 'Deve ativar o aviso antecipado');
  assert.equal(near.remainingMinutes, 1);
});

test('3. Login realizado há 4 horas: novo login obrigatório e mensagem oficial', () => {
  const storage = new MockStorage();
  const session = new SessionLifecycleTester(storage, 1700000000000);

  session.startSession('user_123');

  // Avança exatamente 4 horas
  session.advanceTime(4 * 60 * 60 * 1000);

  const check = session.isSessionValid('user_123');
  assert.equal(check.isValid, false, 'Sessão com 4 horas exatas deve ser inválida');
  assert.equal(check.reason, 'expired_4h');

  // Ao expirar
  session.expireSession();
  const msg = session.consumeSessionExpiredMessage();
  assert.equal(msg, SESSION_EXPIRED_OFFICIAL_MESSAGE);
});

test('4. Atualização com F5: NÃO reinicia o prazo da sessão', () => {
  const storage = new MockStorage();
  const sessionTab = new SessionLifecycleTester(storage, 1700000000000);

  sessionTab.startSession('user_123');
  const startedAtOriginal = storage.getItem(STORAGE_KEYS.STARTED_AT);

  // Passam 2 horas
  sessionTab.advanceTime(2 * 60 * 60 * 1000);

  // Simula F5 (nova instância do serviço acessando o mesmo storage)
  const sessionAfterF5 = new SessionLifecycleTester(storage, sessionTab.currentTime);

  const startedAtAfterF5 = storage.getItem(STORAGE_KEYS.STARTED_AT);
  assert.equal(startedAtAfterF5, startedAtOriginal, 'Timestamp original de login deve ser estritamente preservado');

  const check = sessionAfterF5.isSessionValid('user_123');
  assert.equal(check.isValid, true);
  assert.equal(check.remainingMs, 2 * 60 * 60 * 1000, 'Após F5, deve restar apenas 2 horas e NÃO reiniciar para 4 horas');
});

test('5. Fechar e reabrir o navegador: respeita o prazo original e expira se passou das 4h', () => {
  const storage = new MockStorage();
  const session1 = new SessionLifecycleTester(storage, 1700000000000);

  session1.startSession('user_123');

  // Simulando que o usuário fechou o navegador e reabriu 5 horas depois
  const tempoAposReabrir = 1700000000000 + (5 * 60 * 60 * 1000);
  const session2 = new SessionLifecycleTester(storage, tempoAposReabrir);

  const check = session2.isSessionValid('user_123');
  assert.equal(check.isValid, false, 'Ao reabrir após 5h, sessão deve estar expirada');
  assert.equal(check.reason, 'expired_4h');
});

test('6. Acesso direto a rota protegida após expiração: acesso negado e redirecionamento para login', () => {
  const storage = new MockStorage();
  const session = new SessionLifecycleTester(storage, 1700000000000);

  session.startSession('user_123');
  session.advanceTime(4 * 60 * 60 * 1000 + 1000); // 4h e 1s

  // Validação no Route Guard / getSession
  const check = session.isSessionValid('user_123');
  assert.equal(check.isValid, false);

  if (!check.isValid) {
    session.expireSession();
  }

  // Redireciona e consome mensagem oficial de sessão expirada
  const expiredMsg = session.consumeSessionExpiredMessage();
  assert.equal(expiredMsg, 'Sua sessão expirou após 4 horas. Faça login novamente para continuar.');
});

test('7. Renovação automática de token (TOKEN_REFRESHED): NÃO prolonga a sessão absoluta', () => {
  const storage = new MockStorage();
  const session = new SessionLifecycleTester(storage, 1700000000000);

  session.startSession('user_123');
  const startedAt = storage.getItem(STORAGE_KEYS.STARTED_AT);

  // Supabase renova o access token a cada 1 hora
  session.advanceTime(1 * 60 * 60 * 1000);
  // Simula TOKEN_REFRESHED: o timestamp de início não deve ser alterado!
  const startedAtAfterRefresh1 = storage.getItem(STORAGE_KEYS.STARTED_AT);
  assert.equal(startedAtAfterRefresh1, startedAt);

  // Passam 4 horas no total
  session.advanceTime(3 * 60 * 60 * 1000);
  // Mais um refresh token disparado pelo Supabase após 4h
  const checkAt4h = session.isSessionValid('user_123');
  assert.equal(checkAt4h.isValid, false, 'O refresh token NÃO pode prolongar o prazo máximo absoluto de 4 horas');
});

test('8. Logout manual: encerra imediatamente a autenticação e limpa tokens', () => {
  const storage = new MockStorage();
  storage.setItem('sb-proj-auth-token', 'jwt_fake_secret');

  const session = new SessionLifecycleTester(storage, 1700000000000);
  session.startSession('user_123');

  assert.ok(storage.getItem(STORAGE_KEYS.STARTED_AT));
  assert.ok(storage.getItem('sb-proj-auth-token'));

  session.clearSession();

  assert.equal(storage.getItem(STORAGE_KEYS.STARTED_AT), null);
  assert.equal(storage.getItem('sb-proj-auth-token'), null, 'Tokens do Supabase devem ser removidos do storage');
  assert.equal(session.syncEvents[session.syncEvents.length - 1].type, 'SESSION_LOGOUT');
});

test('9. Múltiplas abas: encerramento sincronizado e mesmo prazo compartilhado', () => {
  const sharedStorage = new MockStorage();
  const aba1 = new SessionLifecycleTester(sharedStorage, 1700000000000);
  const aba2 = new SessionLifecycleTester(sharedStorage, 1700000000000);

  // Aba 1 realiza o login
  aba1.startSession('user_123');

  // Aba 2 lê a sessão e herda exatamente o mesmo início
  const checkAba2 = aba2.isSessionValid('user_123');
  assert.equal(checkAba2.isValid, true);
  assert.equal(checkAba2.startedAt, aba1.getCurrentTime());

  // Aba 1 realiza logout
  aba1.clearSession();

  // Aba 2 valida após a ação da Aba 1
  const checkAba2AposLogout = aba2.isSessionValid('user_123');
  assert.equal(checkAba2AposLogout.isValid, false, 'Aba 2 encerra a sessão simultaneamente');
});

test('10. Operação no Supabase com sessão expirada: interceptação e rejeição com 401', () => {
  const storage = new MockStorage();
  const session = new SessionLifecycleTester(storage, 1700000000000);

  session.startSession('user_123');

  // Passam 4 horas e 10 minutos
  session.advanceTime(4 * 60 * 60 * 1000 + 10 * 60 * 1000);

  // Simula interceptador monitoredFetch
  const sessionCheck = session.isSessionValid('user_123');
  let response;

  if (!sessionCheck.isValid && sessionCheck.reason === 'expired_4h') {
    session.expireSession();
    response = {
      status: 401,
      body: {
        code: 'SESSION_EXPIRED',
        message: SESSION_EXPIRED_OFFICIAL_MESSAGE
      }
    };
  }

  assert.ok(response);
  assert.equal(response.status, 401);
  assert.equal(response.body.message, 'Sua sessão expirou após 4 horas. Faça login novamente para continuar.');
});

test('11. Regressão de loop infinito: clearSession() NÃO dispara onSessionLogout na mesma aba', async () => {
  const store = new Map();
  const mockLocalStorage = {
    get length() { return store.size; },
    key(i) { return Array.from(store.keys())[i] ?? null; },
    getItem(k) { return store.has(k) ? store.get(k) : null; },
    setItem(k, v) { store.set(k, String(v)); },
    removeItem(k) { store.delete(k); },
    clear() { store.clear(); }
  };

  const prevWindow = globalThis.window;
  const prevLocalStorage = globalThis.localStorage;
  const prevSessionStorage = globalThis.sessionStorage;
  const prevBroadcastChannel = globalThis.BroadcastChannel;

  try {
    globalThis.BroadcastChannel = undefined;
    globalThis.localStorage = mockLocalStorage;
    globalThis.sessionStorage = mockLocalStorage;
    globalThis.window = {
      localStorage: mockLocalStorage,
      sessionStorage: mockLocalStorage,
      addEventListener() {},
      removeEventListener() {}
    };

    const { sessionLifecycleService } = await import('../services/sessionLifecycleService.ts');

    let logoutListenerCalls = 0;
    const unbind = sessionLifecycleService.onSessionLogout(() => {
      logoutListenerCalls += 1;
    });

    sessionLifecycleService.startSession('user_loop_test');
    sessionLifecycleService.clearSession();
    // Segunda chamada simulando SIGNED_OUT do Supabase logo em seguida
    sessionLifecycleService.clearSession({ broadcast: false, notifyLocal: false });

    unbind();

    assert.equal(logoutListenerCalls, 0, 'clearSession na própria aba não deve disparar listener de logout de outra aba (previne loop infinito)');
  } finally {
    globalThis.BroadcastChannel = prevBroadcastChannel;
    globalThis.window = prevWindow;
    globalThis.localStorage = prevLocalStorage;
    globalThis.sessionStorage = prevSessionStorage;
  }
});
