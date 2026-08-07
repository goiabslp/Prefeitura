import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ShieldCheck, Loader2 } from 'lucide-react';
import * as OTPAuth from 'otpauth';
import { isAuthSessionValid, isAuthPromoDismissedToday } from '../services/authTimeService';
import { AuthTimePromoModal } from './modals/AuthTimePromoModal';

interface TwoFactorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    secret: string; // Decrypted secret from signature owner
    secret2?: string | null;
    signatureName: string;
}

export const TwoFactorModal: React.FC<TwoFactorModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    secret,
    secret2,
    signatureName
}) => {
    const [token, setToken] = useState('');
    const [error, setError] = useState('');
    const [validating, setValidating] = useState(false);
    const [showPromo, setShowPromo] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setToken('');
            setError('');
            if (!isAuthSessionValid() && !isAuthPromoDismissedToday()) {
                setShowPromo(true);
            } else {
                setShowPromo(false);
            }
        }
    }, [isOpen]);

    if (!isOpen) return null;

    if (showPromo) {
        return (
            <AuthTimePromoModal
                isOpen={showPromo}
                onClose={() => setShowPromo(false)}
                onSuccessAuthorized={() => {
                    setShowPromo(false);
                    onConfirm();
                }}
            />
        );
    }

    const handleVerify = async () => {
        if (token.length !== 6) {
            setError("Digite os 6 dígitos.");
            return;
        }

        setValidating(true);
        // Simulate slight network delay for UX
        await new Promise(r => setTimeout(r, 500));

        try {
            // Validate against Secret 1
            let isValid = false;

            if (secret && secret.trim().length > 0) {
                try {
                    const totp1 = new OTPAuth.TOTP({
                        algorithm: 'SHA1',
                        digits: 6,
                        period: 30,
                        secret: OTPAuth.Secret.fromBase32(secret)
                    });
                    if (totp1.validate({ token, window: 1 }) !== null) {
                        isValid = true;
                    }
                } catch (e) {
                    console.error("2FA Primary Validation Error:", e);
                }
            }

            // If not valid yet and Secret 2 exists, try Secret 2
            if (!isValid && secret2 && secret2.trim().length > 0) {
                try {
                    const totp2 = new OTPAuth.TOTP({
                        algorithm: 'SHA1',
                        digits: 6,
                        period: 30,
                        secret: OTPAuth.Secret.fromBase32(secret2)
                    });
                    if (totp2.validate({ token, window: 1 }) !== null) {
                        isValid = true;
                    }
                } catch (e) {
                    console.error("2FA Secondary Validation Error:", e);
                }
            }

            if (isValid) {
                onConfirm();
            } else {
                setError("Código incorreto ou expirado.");
            }
        } catch (err) {
            console.error(err);
            setError("Erro na validação.");
        } finally {
            setValidating(false);
        }
    };

    return createPortal(
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-scale-in">
                <div className="mx-auto w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mb-4">
                    <ShieldCheck className="w-6 h-6 text-indigo-600" />
                </div>

                <h3 className="text-xl font-bold text-slate-900 text-center mb-2">Autenticação Necessária</h3>
                <p className="text-sm text-slate-500 text-center mb-6">
                    A assinatura de <strong>{signatureName}</strong> está protegida por 2FA. Digite o código do app autenticador.
                </p>

                <div className="space-y-4">
                    <input
                        type="text"
                        value={token}
                        onChange={e => {
                            const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                            setToken(val);
                            setError('');
                            if (val.length === 6) {
                                // Auto-submit could be enabled here, but manual is safer for error handling display
                            }
                        }}
                        className="w-full text-center text-2xl tracking-[0.5em] font-mono p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                        placeholder="000000"
                        autoFocus
                    />
                    {error && <p className="text-red-500 text-xs text-center font-bold">{error}</p>}
                </div>

                <div className="flex gap-3 mt-6">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 text-slate-500 hover:text-slate-700 font-bold transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleVerify}
                        disabled={token.length !== 6 || validating}
                        className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2"
                    >
                        {validating ? <Loader2 className="w-5 h-5 animate-spin" /> : "Confirmar"}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};
