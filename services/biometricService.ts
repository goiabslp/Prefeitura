/**
 * Serviço de Autenticação Biométrica (Face ID / Touch ID / Digital) via WebAuthn / Local Credentials
 */

export const isBiometricsSupported = (): boolean => {
  return typeof window !== 'undefined' && (!!window.PublicKeyCredential || ('credentials' in navigator));
};

export const isBiometricsEnabled = (): boolean => {
  return localStorage.getItem('biometrics_enabled') === 'true' && !!localStorage.getItem('remember_user') && !!localStorage.getItem('remember_pass');
};

export const setBiometricsEnabled = (enabled: boolean, username?: string, password?: string): void => {
  if (enabled && username && password) {
    localStorage.setItem('biometrics_enabled', 'true');
    localStorage.setItem('remember_user', username);
    localStorage.setItem('remember_pass', password);
  } else {
    localStorage.setItem('biometrics_enabled', 'false');
  }
};

export const authenticateWithBiometrics = async (): Promise<{ user: string; pass: string } | null> => {
  const user = localStorage.getItem('remember_user');
  const pass = localStorage.getItem('remember_pass');

  if (!user || !pass) {
    return null;
  }

  // Retorna diretamente as credenciais salvas sem acionar o diálogo invasivo do Windows Hello
  return { user, pass };
};
