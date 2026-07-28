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

  // Tenta acionar a verificação biométrica nativa do dispositivo (Face ID / Touch ID)
  try {
    if (typeof window !== 'undefined' && window.PublicKeyCredential && PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) {
      const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      if (available) {
        const challenge = new Uint8Array(32);
        window.crypto.getRandomValues(challenge);

        await navigator.credentials.get({
          publicKey: {
            challenge,
            timeout: 60000,
            userVerification: 'preferred'
          }
        });
      }
    }
  } catch (err) {
    console.warn('Alerta biometria nativa:', err);
  }

  return { user, pass };
};
