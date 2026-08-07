/**
 * Serviço de Gerenciamento da Autenticação Única por Tempo (Grace Period)
 * Rota de Configuração: /Admin/autenticador
 */

const STORAGE_KEY_GRACE_MINUTES = 'auth_grace_period_minutes';
const STORAGE_KEY_VALID_UNTIL = 'auth_session_valid_until';
const STORAGE_KEY_AUTHENTICATED_AT = 'auth_session_authenticated_at';

export interface AuthTimeSettings {
  gracePeriodMinutes: number; // 0 = exigindo a cada operação (desativado), 5, 15, 30, 60, 240, 480
  validUntil: number | null;
  authenticatedAt: number | null;
}

export const GRACE_PERIOD_OPTIONS = [
  { value: 0, label: 'Exigir a cada operação (Desativado)', description: 'Autenticação solicitada em toda assinatura/ação.' },
  { value: 5, label: '5 Minutos', description: 'Autorização válida por 5 minutos após a primeira validação.' },
  { value: 15, label: '15 Minutos', description: 'Autorização válida por 15 minutos após a primeira validação.' },
  { value: 30, label: '30 Minutos', description: 'Autorização válida por 30 minutos após a primeira validação.' },
  { value: 60, label: '1 Hora', description: 'Autorização válida por 1 hora após a primeira validação.' },
  { value: 240, label: '4 Horas', description: 'Autorização válida por 4 horas após a primeira validação.' },
  { value: 480, label: '8 Horas (Expediente)', description: 'Autorização válida por 8 horas (todo o expediente).' },
];

export const getAuthTimeSettings = (): AuthTimeSettings => {
  const graceStr = localStorage.getItem(STORAGE_KEY_GRACE_MINUTES);
  const validUntilStr = localStorage.getItem(STORAGE_KEY_VALID_UNTIL);
  const authAtStr = localStorage.getItem(STORAGE_KEY_AUTHENTICATED_AT);

  const gracePeriodMinutes = graceStr !== null ? parseInt(graceStr, 10) : 0;
  const validUntil = validUntilStr !== null ? parseInt(validUntilStr, 10) : null;
  const authenticatedAt = authAtStr !== null ? parseInt(authAtStr, 10) : null;

  return {
    gracePeriodMinutes: isNaN(gracePeriodMinutes) ? 0 : gracePeriodMinutes,
    validUntil: isNaN(validUntil as number) ? null : validUntil,
    authenticatedAt: isNaN(authenticatedAt as number) ? null : authenticatedAt,
  };
};

export const setAuthGracePeriodMinutes = (minutes: number): void => {
  localStorage.setItem(STORAGE_KEY_GRACE_MINUTES, minutes.toString());
  if (minutes === 0) {
    clearAuthSession();
  }
};

/**
 * Retorna true se a sessão atual de autenticação estiver ATIVA e no prazo configurado
 */
export const isAuthSessionValid = (): boolean => {
  const { gracePeriodMinutes, validUntil } = getAuthTimeSettings();
  if (gracePeriodMinutes <= 0 || !validUntil) {
    return false;
  }
  return Date.now() < validUntil;
};

/**
 * Retorna os milissegundos restantes para expirar a autorização
 */
export const getAuthSessionTimeRemainingMs = (): number => {
  const { gracePeriodMinutes, validUntil } = getAuthTimeSettings();
  if (gracePeriodMinutes <= 0 || !validUntil) return 0;
  const diff = validUntil - Date.now();
  return diff > 0 ? diff : 0;
};

/**
 * Registra o sucesso de uma autenticação. Se o tempo configurado for > 0,
 * define o timestamp de expiração para a autenticação única por tempo.
 */
export const recordAuthSuccess = (): boolean => {
  const { gracePeriodMinutes } = getAuthTimeSettings();
  if (gracePeriodMinutes > 0) {
    const now = Date.now();
    const expiresAt = now + gracePeriodMinutes * 60 * 1000;
    localStorage.setItem(STORAGE_KEY_VALID_UNTIL, expiresAt.toString());
    localStorage.setItem(STORAGE_KEY_AUTHENTICATED_AT, now.toString());
    return true;
  } else {
    clearAuthSession();
    return false;
  }
};

/**
 * Revoga/encerra imediatamente a autorização temporária por tempo.
 */
export const clearAuthSession = (): void => {
  localStorage.removeItem(STORAGE_KEY_VALID_UNTIL);
  localStorage.removeItem(STORAGE_KEY_AUTHENTICATED_AT);
};

const STORAGE_KEY_PROMO_DISMISSED_DATE = 'auth_time_promo_dismissed_date';

/**
 * Retorna true se o usuário escolheu "não exibir a mensagem novamente hoje" no dia atual.
 * No dia seguinte, a data difere e a mensagem volta a aparecer normalmente.
 */
export const isAuthPromoDismissedToday = (): boolean => {
  const dismissedDate = localStorage.getItem(STORAGE_KEY_PROMO_DISMISSED_DATE);
  if (!dismissedDate) return false;
  const todayStr = new Date().toISOString().split('T')[0];
  return dismissedDate === todayStr;
};

/**
 * Salva a data de hoje para ocultar a sugestão amigável de sessão pelo restante do dia atual.
 */
export const dismissAuthPromoForToday = (): void => {
  const todayStr = new Date().toISOString().split('T')[0];
  localStorage.setItem(STORAGE_KEY_PROMO_DISMISSED_DATE, todayStr);
};
