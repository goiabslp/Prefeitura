import React, { useState } from 'react';
import { User } from '../types';
import { supabase } from '../services/supabaseClient';
import { Eye, EyeOff, Lock, CheckCircle2, Save, LogOut, ShieldCheck, AlertTriangle } from 'lucide-react';

interface ForcePasswordChangeModalProps {
    currentUser: User;
    onSuccess: () => void;
    onLogout: () => void;
}

export const ForcePasswordChangeModal: React.FC<ForcePasswordChangeModalProps> = ({ currentUser, onSuccess, onLogout }) => {
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const requirements = [
        { valid: newPassword.length >= 8, label: "Mínimo 8 caracteres" },
        { valid: /[A-Z]/.test(newPassword), label: "Letra Maiúscula" },
        { valid: /[a-z]/.test(newPassword), label: "Letra Minúscula" },
        { valid: /[0-9]/.test(newPassword), label: "Número" },
        { valid: /[^A-Za-z0-9]/.test(newPassword), label: "Caractere Especial" }
    ];

    const allValid = requirements.every(r => r.valid);
    const match = newPassword === confirmPassword && newPassword !== '';

    const handleSave = async () => {
        if (!allValid) {
            setError("A senha não atende aos requisitos de segurança.");
            return;
        }
        if (!match) {
            setError("As senhas não conferem.");
            return;
        }
        if (newPassword === currentUser.tempPassword) {
            setError("A nova senha não pode ser igual à senha temporária.");
            return;
        }

        setLoading(true);
        setError(null);

        try {
            // 1. Update Password & Metadata in Supabase Auth
            const { error: authError } = await supabase.auth.updateUser({
                password: newPassword,
                data: {
                    temp_password: null,
                    tempPassword: null,
                    temp_password_expires_at: null,
                    tempPasswordExpiresAt: null,
                    must_change_password: false,
                    mustChangePassword: false
                }
            });
            if (authError) throw authError;

            // 2. Clear temp_password and must_change_password in profiles table to permanently unlock access
            const { error: dbError } = await supabase
                .from('profiles')
                .update({
                    temp_password: null,
                    temp_password_expires_at: null,
                    must_change_password: false
                })
                .eq('id', currentUser.id);

            if (dbError) throw dbError;

            // Success
            onSuccess();
        } catch (err: any) {
            console.error("Error changing password:", err);
            setError(err.message || "Erro ao alterar senha. Tente novamente.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/90 backdrop-blur-md p-4 animate-fade-in overflow-y-auto">
            <div className="bg-white rounded-3xl md:rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col items-center animate-scale-in border border-white/10 relative my-auto">

                {/* Decorative Header */}
                <div className="w-full h-24 md:h-32 bg-gradient-to-br from-indigo-600 to-violet-700 flex items-center justify-center relative overflow-hidden shrink-0">
                    <div className="absolute inset-0 opacity-20">
                        <svg className="h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                            <path d="M0 100 C 20 0 50 0 100 100 Z" fill="white" />
                        </svg>
                    </div>
                    <div className="relative z-10 w-16 h-16 md:w-20 md:h-20 bg-white/20 backdrop-blur-xl rounded-2xl flex items-center justify-center shadow-lg border border-white/30 text-white">
                        <ShieldCheck className="w-8 h-8 md:w-10 md:h-10" />
                    </div>
                </div>

                <div className="p-6 md:p-8 w-full flex flex-col gap-5 md:gap-6">
                    <div className="text-center">
                        <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">Alteração Obrigatória</h2>
                        <p className="text-slate-500 mt-2 text-xs md:text-sm font-medium leading-relaxed">
                            Detectamos o uso de uma senha temporária. Para sua segurança, defina uma nova senha pessoal.
                        </p>
                    </div>

                    {error && (
                        <div className="bg-rose-50 border border-rose-200 text-rose-600 px-4 py-3 rounded-xl text-xs font-bold flex items-center gap-2 animate-shake">
                            <AlertTriangle className="w-4 h-4 shrink-0" />
                            {error}
                        </div>
                    )}

                    <div className="space-y-4">
                        <div className="space-y-1">
                            <label className="text-[10px] md:text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">Nova Senha</label>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 font-bold rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all placeholder:text-slate-400 placeholder:font-normal text-sm md:text-base"
                                    placeholder="Defina sua nova senha"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 transition-colors"
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        {/* Strength Checklist */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-1">
                            {requirements.map((req, idx) => (
                                <div key={idx} className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors duration-300 ${req.valid ? 'text-emerald-600' : 'text-slate-400'}`}>
                                    {req.valid ? <CheckCircle2 className="w-3 h-3 shrink-0" /> : <div className="w-3 h-3 shrink-0 rounded-full border-2 border-slate-300" />}
                                    {req.label}
                                </div>
                            ))}
                        </div>

                        <div className="space-y-1 pt-1 md:pt-2">
                            <label className="text-[10px] md:text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">Confirmar Senha</label>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className={`w-full bg-slate-50 border text-slate-900 font-bold rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all placeholder:text-slate-400 placeholder:font-normal text-sm md:text-base
                                ${confirmPassword && !match ? 'border-rose-300 focus:border-rose-500' : 'border-slate-200 focus:border-indigo-500'}`}
                                    placeholder="Repita a nova senha"
                                />
                                {confirmPassword && match && (
                                    <CheckCircle2 className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-500 w-5 h-5 animate-scale-in" />
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col gap-3 mt-2">
                        <button
                            onClick={handleSave}
                            disabled={!allValid || !match || loading}
                            className="w-full py-3.5 md:py-4 bg-indigo-600 text-white font-black uppercase tracking-widest rounded-xl hover:bg-indigo-700 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/30 flex items-center justify-center gap-2 text-xs md:text-sm"
                        >
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    <Save className="w-5 h-5" />
                                    Salvar Nova Senha
                                </>
                            )}
                        </button>

                        <button
                            onClick={onLogout}
                            className="w-full py-3 text-slate-400 hover:text-rose-500 font-bold text-[10px] md:text-xs uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
                        >
                            <LogOut className="w-4 h-4" /> Sair
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
