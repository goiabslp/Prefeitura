import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { Session } from '@supabase/supabase-js';
import { User, UserRole } from '../types';
import { clearOldUpdateFlags, canExecuteSystemUpdateLogout } from '../services/systemUpdateService';
import { sessionLifecycleService, SESSION_EXPIRED_OFFICIAL_MESSAGE } from '../services/sessionLifecycleService';

interface AuthContextType {
    user: User | null;
    session: Session | null;
    loading: boolean;
    signIn: (email: string, password: string) => Promise<{ error: any }>;
    signOut: (reason?: string) => Promise<void>;
    refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    session: null,
    loading: true,
    signIn: async () => ({ error: 'Not implemented' }),
    signOut: async (_reason?: string) => { },
    refreshUser: async () => { },
});

const hasStoredSession = (): boolean => {
    if (typeof window === 'undefined') return false;
    try {
        for (let i = 0; i < window.localStorage.length; i++) {
            const key = window.localStorage.key(i);
            if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
                const val = window.localStorage.getItem(key);
                if (val && val !== 'null' && val !== '{}') return true;
            }
        }
        for (let i = 0; i < window.sessionStorage.length; i++) {
            const key = window.sessionStorage.key(i);
            if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
                const val = window.sessionStorage.getItem(key);
                if (val && val !== 'null' && val !== '{}') return true;
            }
        }
    } catch (e) {
        return false;
    }
    return false;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState<boolean>(true);

    useEffect(() => {
        // Validação da Sessão Ativa ao carregar ou acessar o link da aplicação
        supabase.auth.getSession().then(async ({ data: { session } }) => {
            if (session?.user) {
                // REGRA OBRIGATÓRIA: Sessão dura no máximo 4 horas desde a autenticação original
                const sessionCheck = sessionLifecycleService.isSessionValid(session.user.id);
                if (!sessionCheck.isValid) {
                    console.warn(`[AUTH] Sessão do Supabase rejeitada na inicialização: ${sessionCheck.reason}. Limite de 4 horas atingido ou inexistente.`);
                    if (sessionCheck.reason === 'expired_4h') {
                        sessionLifecycleService.expireSession(SESSION_EXPIRED_OFFICIAL_MESSAGE);
                    } else {
                        sessionLifecycleService.clearSession();
                    }
                    await supabase.auth.signOut();
                    setSession(null);
                    setUser(null);
                    setLoading(false);
                    return;
                }

                setSession(session);
                fetchProfile(session.user.id, session.user.email || '');
            } else {
                sessionLifecycleService.clearSession();
                setSession(null);
                setUser(null);
                setLoading(false);
            }
        }).catch(err => {
            console.error('Error getting session:', err);
            setLoading(false);
        });

        // Escuta alterações de estado de autenticação
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            console.log(`[AUTH-DIAGNOSTIC] onAuthStateChange event: ${event}, user: ${session?.user?.id || 'none'}`);
            if (event === 'SIGNED_IN') {
                // Ao fazer login: limpa flags antigas de atualização e impede falsos positivos
                clearOldUpdateFlags();

                if (session?.user) {
                    const check = sessionLifecycleService.isSessionValid(session.user.id);
                    if (!check.isValid) {
                        if (check.reason === 'missing_session') {
                            sessionLifecycleService.startSession(session.user.id);
                        } else if (check.reason === 'expired_4h') {
                            console.warn('[AUTH] Sessão expirada detectada no SIGNED_IN. Desconectando.');
                            sessionLifecycleService.expireSession(SESSION_EXPIRED_OFFICIAL_MESSAGE);
                            await supabase.auth.signOut();
                            setUser(null);
                            setSession(null);
                            setLoading(false);
                            return;
                        }
                    }
                }
            } else if (event === 'TOKEN_REFRESHED') {
                // REGRA OBRIGATÓRIA: Renovação de access token NÃO prolonga as 4 horas originais
                if (session?.user) {
                    const check = sessionLifecycleService.isSessionValid(session.user.id);
                    if (!check.isValid) {
                        console.warn('[AUTH] Token refreshed rejeitado: sessão ultrapassou o limite absoluto de 4 horas.');
                        sessionLifecycleService.expireSession(SESSION_EXPIRED_OFFICIAL_MESSAGE);
                        await supabase.auth.signOut();
                        setUser(null);
                        setSession(null);
                        setLoading(false);
                        return;
                    }
                }
            } else if (event === 'SIGNED_OUT') {
                sessionLifecycleService.clearSession();
                setUser(null);
                setSession(null);
                setLoading(false);
                return;
            }

            setSession(session);
            if (session?.user) {
                fetchProfile(session.user.id, session.user.email || '');
            } else {
                setUser(null);
                setLoading(false);
            }
        });

        const channel = supabase.channel('global_events')
            .on('broadcast', { event: 'user-blocked' }, async (payload) => {
                if (payload.payload?.userId) {
                    // Check if current session user is the blocked user
                    const currentSession = await supabase.auth.getSession();
                    if (currentSession.data.session?.user?.id === payload.payload.userId) {
                        alert('Seu usuário foi bloqueado por um administrador. Você foi desconectado.');
                        console.warn(`[AUTH-DIAGNOSTIC] Origem do logout:
função: onBroadcast(user-blocked)
arquivo: contexts/AuthContext.tsx
motivo: Usuário bloqueado via broadcast em tempo real
updateId: N/A
userId: ${payload.payload.userId}
authEvent: user-blocked
timestamp: ${new Date().toISOString()}`);
                        await supabase.auth.signOut();
                        setUser(null);
                        setSession(null);
                    }
                }
            })
            .subscribe();

        return () => {
            subscription.unsubscribe();
            supabase.removeChannel(channel);
        };
    }, []);

    const fetchProfile = async (userId: string, email: string) => {
        try {
            const profileColumns = 'id, username, name, role, test_role, sector, sector_id, job_title, job_id, allowed_signature_ids, permissions, temp_password, temp_password_expires_at, email, whatsapp, two_factor_enabled, two_factor_secret, two_factor_enabled_2, two_factor_secret_2, must_change_password, status';
            const { data, error } = await supabase
                .from('profiles')
                .select(profileColumns)
                .eq('id', userId)
                .single();

            if (error) {
                console.error('Error fetching profile:', error);
                // Fallback or handle error (maybe user exists in Auth but not in profiles?)
                setLoading(false);
                return;
            }

            if (data) {
                const appUser: User = {
                    id: data.id,
                    username: data.username || email.split('@')[0], // Fallback username
                    name: data.name || '',
                    role: (data.role as UserRole) || 'collaborator',
                    testRole: data.test_role || (localStorage.getItem(`test_role_${data.id}`) as UserRole) || undefined,
                    sector: data.sector,
                    sectorId: data.sector_id,
                    jobTitle: data.job_title,
                    jobId: data.job_id,
                    allowedSignatureIds: data.allowed_signature_ids || [],
                    permissions: data.permissions || [],
                    tempPassword: data.temp_password || undefined,
                    tempPasswordExpiresAt: data.temp_password_expires_at || undefined,
                    email: data.email || email,
                    whatsapp: data.whatsapp,
                    twoFactorEnabled: data.two_factor_enabled,
                    twoFactorSecret: data.two_factor_secret,
                    twoFactorEnabled2: data.two_factor_enabled_2,
                    twoFactorSecret2: data.two_factor_secret_2,
                    mustChangePassword: !!data.must_change_password,
                    status: data.status || 'active'
                };

                if (appUser.status === 'blocked') {
                    console.warn(`[AUTH-DIAGNOSTIC] Origem do logout:
função: fetchProfile
arquivo: contexts/AuthContext.tsx
motivo: Status da conta é blocked no profiles
updateId: N/A
userId: ${appUser.id}
authEvent: fetchProfile_blocked
timestamp: ${new Date().toISOString()}`);
                    alert('Sua conta está bloqueada pelo administrador.');
                    await supabase.auth.signOut();
                    setUser(null);
                    setSession(null);
                    setLoading(false);
                    return;
                }

                setUser(appUser);

                // Broadcast Login Event (Only if just signed in or first load - but context loads on every refresh. 
                // To avoid spam on every refresh, maybe check sessionStorage? 
                // However, "real-time popup when user enters" usually means when they open the app.
                // Let's use sessionStorage to only send once per browser session.)

                const hasBroadcasted = sessionStorage.getItem(`login_broadcast_${data.id}`);
                if (!hasBroadcasted) {
                    await supabase.channel('global_events').send({
                        type: 'broadcast',
                        event: 'user-login',
                        payload: {
                            username: appUser.name,
                            role: appUser.role
                        }
                    });
                    sessionStorage.setItem(`login_broadcast_${data.id}`, 'true');
                }
            }
        } catch (err) {
            console.error('Unexpected error fetching profile:', err);
        } finally {
            setLoading(false);
        }
    };

    const signIn = async (email: string, password: string) => {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });
        if (!error && data?.user) {
            // Inicia imediatamente o ciclo de 4 horas para a nova sessão
            sessionLifecycleService.startSession(data.user.id);
        }
        return { data, error };
    };

    const signOut = async (reason = 'Ação manual do usuário / Logout') => {
        if (reason === 'Atualização do Sistema Concluída') {
            const validation = canExecuteSystemUpdateLogout();
            if (!validation.allowed) {
                console.warn(`[AUTH-DIAGNOSTIC] Bloqueio de signOut por atualização indevida: ${validation.reason}`);
                return;
            }
        }
        console.warn(`[AUTH-DIAGNOSTIC] Origem do logout:
função: signOut
arquivo: contexts/AuthContext.tsx
motivo: ${reason}
updateId: N/A
userId: ${user?.id || 'N/A'}
authEvent: explicit_signOut
timestamp: ${new Date().toISOString()}`);

        sessionLifecycleService.clearSession();
        await supabase.auth.signOut();
        setUser(null);
        setSession(null);
    };

    // Monitoramento contínuo em tempo real da vigência de 4 horas e sincronização entre abas
    useEffect(() => {
        if (!session?.user) return;

        // 1. Checagem periódica a cada 10 segundos
        const intervalId = setInterval(() => {
            const check = sessionLifecycleService.isSessionValid(session.user.id);
            if (!check.isValid && check.reason === 'expired_4h') {
                console.warn('[AUTH] Sessão atingiu o limite de 4 horas em tempo real. Encerrando acesso.');
                sessionLifecycleService.expireSession(SESSION_EXPIRED_OFFICIAL_MESSAGE);
                supabase.auth.signOut();
                setUser(null);
                setSession(null);
            }
        }, 10000);

        // 2. Checagem imediata ao focar na janela ou alternar abas
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                const check = sessionLifecycleService.isSessionValid(session.user.id);
                if (!check.isValid && check.reason === 'expired_4h') {
                    console.warn('[AUTH] Sessão expirou enquanto a aba estava em segundo plano. Encerrando.');
                    sessionLifecycleService.expireSession(SESSION_EXPIRED_OFFICIAL_MESSAGE);
                    supabase.auth.signOut();
                    setUser(null);
                    setSession(null);
                }
            }
        };

        window.addEventListener('focus', handleVisibilityChange);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        // 3. Ouvintes de eventos multi-abas
        const unbindExpired = sessionLifecycleService.onSessionExpired(async () => {
            console.warn('[AUTH] Sessão expirada em outra aba. Sincronizando encerramento.');
            await supabase.auth.signOut();
            setUser(null);
            setSession(null);
        });

        const unbindLogout = sessionLifecycleService.onSessionLogout(async () => {
            console.warn('[AUTH] Logout efetuado em outra aba. Sincronizando encerramento.');
            await supabase.auth.signOut();
            setUser(null);
            setSession(null);
        });

        return () => {
            clearInterval(intervalId);
            window.removeEventListener('focus', handleVisibilityChange);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            unbindExpired();
            unbindLogout();
        };
    }, [session?.user?.id]);

    const refreshUser = async () => {
        if (session?.user) {
            await fetchProfile(session.user.id, session.user.email || '');
        }
    };

    // Sincroniza alterações de permissões e perfil do usuário autenticado em tempo real (sem exigir novo login)
    useEffect(() => {
        const uid = session?.user?.id;
        if (!uid) return;

        const profileSyncChannel = supabase
            .channel(`auth_profile_sync_${uid}`)
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${uid}` },
                () => {
                    fetchProfile(uid, session?.user?.email || '');
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(profileSyncChannel);
        };
    }, [session?.user?.id, session?.user?.email]);

    return (
        <AuthContext.Provider value={{ user, session, loading, signIn, signOut, refreshUser }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
