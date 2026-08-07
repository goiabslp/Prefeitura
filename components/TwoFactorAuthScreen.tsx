import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { ShieldCheck, Smartphone, RefreshCw, CheckCircle, AlertTriangle, Lock, ArrowLeft, Plus, Clock, Zap, Check, ShieldAlert } from 'lucide-react';
import * as OTPAuth from 'otpauth';
import QRCode from 'qrcode';
import { supabase } from '../services/supabaseClient';
import {
    getAuthTimeSettings,
    setAuthGracePeriodMinutes,
    isAuthSessionValid,
    getAuthSessionTimeRemainingMs,
    clearAuthSession,
    GRACE_PERIOD_OPTIONS
} from '../services/authTimeService';

interface TwoFactorAuthScreenProps {
    currentUser: User;
    onUpdateUser: (updatedUser: User) => void;
    onBack?: () => void;
}

export const TwoFactorAuthScreen: React.FC<TwoFactorAuthScreenProps> = ({ currentUser, onUpdateUser, onBack }) => {
    const [editingSlot, setEditingSlot] = useState<1 | 2 | null>(null);

    // Setup state
    const [step, setStep] = useState<'intro' | 'setup' | 'verify'>('intro');
    const [secret, setSecret] = useState<string>('');
    const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
    const [token, setToken] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // Estado da Autenticação Única por Tempo
    const [authSettings, setAuthSettings] = useState(getAuthTimeSettings());
    const [timeRemainingMs, setTimeRemainingMs] = useState(getAuthSessionTimeRemainingMs());

    useEffect(() => {
        const timer = setInterval(() => {
            setAuthSettings(getAuthTimeSettings());
            setTimeRemainingMs(getAuthSessionTimeRemainingMs());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    const formatTimeRemaining = (ms: number) => {
        if (ms <= 0) return 'Expirado';
        const totalSec = Math.floor(ms / 1000);
        const hours = Math.floor(totalSec / 3600);
        const mins = Math.floor((totalSec % 3600) / 60);
        const secs = totalSec % 60;
        if (hours > 0) {
            return `${hours}h ${mins.toString().padStart(2, '0')}m ${secs.toString().padStart(2, '0')}s`;
        }
        return `${mins.toString().padStart(2, '0')}m ${secs.toString().padStart(2, '0')}s`;
    };

    useEffect(() => {
        if (successMessage) {
            const timer = setTimeout(() => setSuccessMessage(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [successMessage]);

    const isEnabled1 = currentUser.twoFactorEnabled || false;
    const isEnabled2 = currentUser.twoFactorEnabled2 || false;

    const resetSetupState = () => {
        setStep('intro');
        setSecret('');
        setQrCodeUrl('');
        setToken('');
        setError('');
        setLoading(false);
    };

    const handleStartSetup = async (slot: 1 | 2) => {
        setEditingSlot(slot);
        setSuccessMessage(null);
        setLoading(true);
        setError('');

        const newSecret = new OTPAuth.Secret({ size: 20 });
        const secretStr = newSecret.base32;
        setSecret(secretStr);

        const label = `${currentUser.username}${slot === 2 ? ' (Backup)' : ''}`;

        const totp = new OTPAuth.TOTP({
            issuer: 'Assinatura Prefeitura Goiabal',
            label: label,
            algorithm: 'SHA1',
            digits: 6,
            period: 30,
            secret: newSecret
        });

        try {
            const url = await QRCode.toDataURL(totp.toString());
            setQrCodeUrl(url);
            setStep('setup');
        } catch (err) {
            console.error(err);
            setError('Erro ao gerar QR Code.');
        } finally {
            setLoading(false);
        }
    };

    const verifyAndEnable = async () => {
        if (!token || token.length !== 6) {
            setError('Digite o código de 6 dígitos.');
            return;
        }

        const totp = new OTPAuth.TOTP({
            algorithm: 'SHA1',
            digits: 6,
            period: 30,
            secret: OTPAuth.Secret.fromBase32(secret)
        });

        const delta = totp.validate({ token, window: 1 });

        if (delta === null) {
            setError('Código inválido. Tente novamente.');
            return;
        }

        setLoading(true);
        try {
            const updateData: any = {};
            if (editingSlot === 1) {
                updateData.two_factor_secret = secret;
                updateData.two_factor_enabled = true;
            } else {
                updateData.two_factor_secret_2 = secret;
                updateData.two_factor_enabled_2 = true;
            }

            const { error: dbError } = await supabase
                .from('profiles')
                .update(updateData)
                .eq('id', currentUser.id);

            if (dbError) throw dbError;

            await supabase.from('audit_logs').insert({
                user_id: currentUser.id,
                action: '2fa_enable',
                details: { method: 'totp', slot: editingSlot }
            });

            const updatedUser = { ...currentUser };
            if (editingSlot === 1) {
                updatedUser.twoFactorEnabled = true;
                updatedUser.twoFactorSecret = secret;
            } else {
                updatedUser.twoFactorEnabled2 = true;
                updatedUser.twoFactorSecret2 = secret;
            }

            onUpdateUser(updatedUser);
            setSuccessMessage(`Autenticador ${editingSlot} ativado com sucesso!`);
            setEditingSlot(null);
            resetSetupState();

        } catch (err: any) {
            console.error(err);
            setError('Erro ao salvar: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const confirmDisable = async (slot: 1 | 2) => {
        if (!confirm(`Tem certeza que deseja remover o Autenticador ${slot}?`)) return;

        setLoading(true);
        try {
            const updateData: any = {};
            if (slot === 1) {
                updateData.two_factor_secret = null;
                updateData.two_factor_enabled = false;
            } else {
                updateData.two_factor_secret_2 = null;
                updateData.two_factor_enabled_2 = false;
            }

            const { error: dbError } = await supabase
                .from('profiles')
                .update(updateData)
                .eq('id', currentUser.id);

            if (dbError) throw dbError;

            await supabase.from('audit_logs').insert({
                user_id: currentUser.id,
                action: '2fa_disable',
                details: { slot }
            });

            const updatedUser = { ...currentUser };
            if (slot === 1) {
                updatedUser.twoFactorEnabled = false;
                updatedUser.twoFactorSecret = undefined;
            } else {
                updatedUser.twoFactorEnabled2 = false;
                updatedUser.twoFactorSecret2 = undefined;
            }

            onUpdateUser(updatedUser);
            setSuccessMessage(`Autenticador ${slot} desativado.`);
        } catch (err: any) {
            console.error(err);
            alert('Erro ao desativar: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    // If we are actively editing a slot, show setup UI
    if (editingSlot) {
        return (
            <div className="w-full max-w-3xl mx-auto p-4 sm:p-6 animate-fade-in bg-white border border-slate-200 rounded-3xl shadow-xl my-6">
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
                    <h3 className="text-lg font-bold text-slate-800">
                        Configurando Autenticador {editingSlot}
                    </h3>
                    <button
                        onClick={() => { setEditingSlot(null); resetSetupState(); }}
                        className="p-2 hover:bg-slate-100 rounded-full text-slate-400"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                    <div className="bg-slate-50 p-6 rounded-2xl text-center border border-slate-100 flex flex-col items-center justify-center">
                        <p className="text-[10px] font-bold text-slate-500 mb-4 uppercase tracking-widest">Escaneie com seu app</p>
                        <div className="bg-white p-3 rounded-xl shadow-sm mb-4">
                            {qrCodeUrl && <img src={qrCodeUrl} alt="2FA QR Code" className="w-40 h-40 mix-blend-multiply" />}
                        </div>

                        <div className="flex flex-col items-center gap-1.5">
                            <p className="text-[10px] text-slate-400 font-medium">Chave Secreta</p>
                            <code
                                className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-mono select-all cursor-pointer hover:border-indigo-300 transition-colors text-slate-600"
                                onClick={() => navigator.clipboard.writeText(secret)}
                                title="Clique para copiar"
                            >
                                {secret}
                            </code>
                        </div>
                    </div>

                    <div className="space-y-5">
                        <div>
                            <h3 className="text-base font-bold text-slate-900 mb-1">Confirme a configuração</h3>
                            <p className="text-xs text-slate-500">Insira o código de 6 dígitos gerado pelo app.</p>
                        </div>

                        <div className="space-y-3">
                            <input
                                type="text"
                                value={token}
                                onChange={e => {
                                    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                                    setToken(val);
                                    setError('');
                                }}
                                className="w-full p-3 border-2 border-slate-200 rounded-xl font-mono text-center text-xl tracking-[0.4em] focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all"
                                placeholder="000000"
                                autoFocus
                            />

                            <button
                                onClick={verifyAndEnable}
                                disabled={token.length !== 6 || loading}
                                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-md shadow-emerald-200 flex items-center justify-center gap-2"
                            >
                                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                                Ativar Autenticador {editingSlot}
                            </button>

                            {error && <p className="text-red-500 text-xs text-center font-bold animate-shake bg-red-50 p-2 rounded-lg">{error}</p>}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Dashboard View - Streamlined & Compact Layout
    return (
        <div className="w-full max-w-5xl mx-auto p-4 sm:p-6 pb-24 animate-fade-in space-y-6">
            {successMessage && (
                <div className="p-4 bg-emerald-100 text-emerald-800 rounded-2xl flex items-center gap-3 animate-slide-down shadow-sm">
                    <CheckCircle className="w-5 h-5 shrink-0" />
                    <span className="font-bold text-sm">{successMessage}</span>
                    <button onClick={() => setSuccessMessage(null)} className="ml-auto p-1 hover:bg-emerald-200 rounded-full transition-colors">
                        <ArrowLeft className="w-4 h-4 rotate-180" />
                    </button>
                </div>
            )}

            {/* Cabeçalho da Página */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    {onBack && (
                        <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 transition-colors shrink-0">
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                    )}
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Dispositivos de Segurança</h2>
                            <span className="px-2.5 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-mono font-bold rounded-md border border-slate-200">
                                /Admin/autenticador
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 font-medium mt-0.5">
                            Gerencie os aplicativos de autenticação 2FA e as regras de validade temporária por sessão.
                        </p>
                    </div>
                </div>

                {/* Resumo de Status Rápido */}
                <div className="flex items-center gap-2 shrink-0">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 ${
                        isEnabled1 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
                    }`}>
                        {isEnabled1 ? <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> : <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />}
                        {isEnabled1 ? '2FA Ativado' : '2FA Pendente'}
                    </span>
                    {isAuthSessionValid() && (
                        <span className="px-3 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full text-xs font-mono font-bold flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-indigo-600 animate-pulse" />
                            {formatTimeRemaining(timeRemainingMs)}
                        </span>
                    )}
                </div>
            </div>

            {/* Grid dos 2 Autenticadores */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Slot 1 */}
                <div className={`p-5 rounded-2xl border-2 transition-all duration-300 ${
                    isEnabled1 ? 'bg-emerald-50/40 border-emerald-500 shadow-sm' : 'bg-white border-slate-200 border-dashed'
                }`}>
                    <div className="flex items-center justify-between gap-3 mb-4">
                        <div className="flex items-center gap-3">
                            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shadow-xs ${
                                isEnabled1 ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'
                            }`}>
                                <Smartphone className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className={`text-base font-black ${isEnabled1 ? 'text-emerald-950' : 'text-slate-800'}`}>Autenticador 01</h3>
                                <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${
                                    isEnabled1 ? 'bg-emerald-200/80 text-emerald-900' : 'bg-slate-200 text-slate-500'
                                }`}>
                                    {isEnabled1 ? 'Ativo (Principal)' : 'Pendente'}
                                </span>
                            </div>
                        </div>
                        {isEnabled1 && <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />}
                    </div>

                    {isEnabled1 ? (
                        <div className="space-y-3">
                            <p className="text-xs text-emerald-900 bg-white/70 p-3 rounded-xl border border-emerald-100 leading-relaxed font-medium">
                                Este dispositivo está protegendo sua conta para assinaturas digitais.
                            </p>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => handleStartSetup(1)}
                                    className="py-2.5 bg-white border border-emerald-200 text-emerald-800 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-emerald-100 transition-colors flex items-center justify-center gap-1.5"
                                >
                                    <RefreshCw className="w-3 h-3" /> Redefinir
                                </button>
                                <button
                                    onClick={() => confirmDisable(1)}
                                    className="py-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-rose-100 transition-colors flex items-center justify-center gap-1.5"
                                >
                                    <Lock className="w-3 h-3" /> Resetar
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <p className="text-xs text-slate-500">Configure seu dispositivo principal para ativar a segurança.</p>
                            <button
                                onClick={() => handleStartSetup(1)}
                                className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-sm transition-all flex items-center justify-center gap-1.5"
                            >
                                <Plus className="w-3.5 h-3.5" /> Configurar Agora
                            </button>
                        </div>
                    )}
                </div>

                {/* Slot 2 */}
                <div className={`p-5 rounded-2xl border-2 transition-all duration-300 ${
                    isEnabled2 ? 'bg-indigo-50/40 border-indigo-500 shadow-sm' : 'bg-white border-slate-200 border-dashed'
                }`}>
                    <div className="flex items-center justify-between gap-3 mb-4">
                        <div className="flex items-center gap-3">
                            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shadow-xs ${
                                isEnabled2 ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'
                            }`}>
                                <Smartphone className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className={`text-base font-black ${isEnabled2 ? 'text-indigo-950' : 'text-slate-800'}`}>Autenticador 02</h3>
                                <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${
                                    isEnabled2 ? 'bg-indigo-200/80 text-indigo-900' : 'bg-slate-200 text-slate-500'
                                }`}>
                                    {isEnabled2 ? 'Ativo (Reserva)' : 'Opcional'}
                                </span>
                            </div>
                        </div>
                        {isEnabled2 && <CheckCircle className="w-5 h-5 text-indigo-600 shrink-0" />}
                    </div>

                    {isEnabled2 ? (
                        <div className="space-y-3">
                            <p className="text-xs text-indigo-900 bg-white/70 p-3 rounded-xl border border-indigo-100 leading-relaxed font-medium">
                                Dispositivo de backup ativo. Você pode usar qualquer um dos dois para assinar.
                            </p>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => handleStartSetup(2)}
                                    className="py-2.5 bg-white border border-indigo-200 text-indigo-800 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-indigo-100 transition-colors flex items-center justify-center gap-1.5"
                                >
                                    <RefreshCw className="w-3 h-3" /> Redefinir
                                </button>
                                <button
                                    onClick={() => confirmDisable(2)}
                                    className="py-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-rose-100 transition-colors flex items-center justify-center gap-1.5"
                                >
                                    <Lock className="w-3 h-3" /> Resetar
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <p className="text-xs text-slate-500">Adicione um segundo dispositivo como reserva de segurança.</p>
                            <button
                                onClick={() => handleStartSetup(2)}
                                disabled={!isEnabled1}
                                className="w-full py-3 bg-white border-2 border-indigo-200 text-indigo-700 disabled:opacity-50 disabled:border-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-indigo-50 transition-all flex items-center justify-center gap-1.5"
                            >
                                <Plus className="w-3.5 h-3.5" /> {isEnabled1 ? 'Configurar Reserva' : 'Ative o 01 Primeiro'}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* SEÇÃO: AUTENTICAÇÃO ÚNICA POR TEMPO */}
            <div className="p-5 sm:p-6 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100 shadow-inner shrink-0">
                            <Clock className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-slate-900 tracking-tight">Autenticação Única por Tempo</h3>
                            <p className="text-xs text-slate-500 font-medium mt-0.5">
                                Defina por quanto tempo a autenticação permanece autorizada após a primeira validação.
                            </p>
                        </div>
                    </div>

                    {/* Status da Sessão Ativa */}
                    <div className="shrink-0">
                        {isAuthSessionValid() ? (
                            <div className="bg-emerald-50 border border-emerald-200 p-2.5 px-3.5 rounded-xl flex items-center gap-2.5 shadow-2xs">
                                <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping shrink-0" />
                                <div>
                                    <span className="block text-[9px] font-black uppercase tracking-wider text-emerald-700">Autorizado</span>
                                    <span className="text-xs font-mono font-bold text-emerald-950">{formatTimeRemaining(timeRemainingMs)}</span>
                                </div>
                                <button
                                    onClick={() => {
                                        clearAuthSession();
                                        setAuthSettings(getAuthTimeSettings());
                                        setTimeRemainingMs(0);
                                    }}
                                    className="ml-2 text-[9px] font-black uppercase tracking-wider px-2 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg transition-colors shadow-2xs"
                                    title="Encerrar autorização imediatamente"
                                >
                                    Revogar
                                </button>
                            </div>
                        ) : (
                            <div className="bg-slate-100 border border-slate-200 p-2.5 px-3.5 rounded-xl text-right">
                                <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">Modo Atual</span>
                                <span className="text-xs font-bold text-slate-700">Exigir a cada operação</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Opções de Tempo */}
                <div className="space-y-2">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        Selecione a Duração da Validade
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2">
                        {GRACE_PERIOD_OPTIONS.map((opt) => {
                            const isSelected = authSettings.gracePeriodMinutes === opt.value;
                            return (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => {
                                        setAuthGracePeriodMinutes(opt.value);
                                        setAuthSettings(getAuthTimeSettings());
                                        setTimeRemainingMs(getAuthSessionTimeRemainingMs());
                                    }}
                                    className={`
                                        p-3 rounded-xl text-center border-2 transition-all flex flex-col items-center justify-center gap-1 active:scale-95 cursor-pointer
                                        ${isSelected
                                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-md ring-2 ring-indigo-300'
                                            : 'bg-slate-50 border-slate-200 hover:border-slate-300 hover:bg-white text-slate-700'
                                        }
                                    `}
                                >
                                    <span className={`text-xs font-black uppercase tracking-wider ${isSelected ? 'text-white' : 'text-slate-800'}`}>
                                        {opt.value === 0 ? 'Desativado' : opt.label}
                                    </span>
                                    {opt.value > 0 && (
                                        <span className={`text-[9px] font-bold ${isSelected ? 'text-indigo-200' : 'text-slate-400'}`}>
                                            {opt.value >= 60 ? `${opt.value / 60}h` : `${opt.value}m`}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Banner Explicativo */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-start gap-3 text-xs text-slate-600">
                <ShieldCheck className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                    <strong className="text-slate-900 block font-bold">Como funciona a Autenticação Única por Tempo?</strong>
                    <p className="leading-relaxed">
                        Ao escolher um intervalo (ex: 15min ou 1 hora), o código 2FA será solicitado apenas na <strong>primeira assinatura</strong>. 
                        Após validado, você poderá assinar novos documentos livremente até o tempo expirar ou revogar manualmente.
                    </p>
                </div>
            </div>
        </div>
    );
};
