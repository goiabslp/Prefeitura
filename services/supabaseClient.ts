/// <reference types="vite/client" />

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase URL and Anon Key missing! Authentication will not work properly.');
}

// Limpeza preventiva de sessões legadas salvas em localStorage para que novas sessões vão diretamente para a tela de login
if (typeof window !== 'undefined') {
    try {
        const legacyKeys: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
                legacyKeys.push(key);
            }
        }
        legacyKeys.forEach(k => localStorage.removeItem(k));
    } catch (e) {
        console.warn('Erro ao verificar chaves legadas de autenticação:', e);
    }
}

export const supabase = createClient(
    supabaseUrl || '',
    supabaseAnonKey || '',
    {
        auth: {
            persistSession: true,
            storage: typeof window !== 'undefined' ? window.sessionStorage : undefined,
            autoRefreshToken: true,
            detectSessionInUrl: true
        },
        realtime: {
            params: {
                eventsPerSecond: 10
            }
        }
    }
);

