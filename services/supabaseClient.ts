/// <reference types="vite/client" />

import { createClient } from '@supabase/supabase-js';
import { egressMonitor } from './egressMonitorService';

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

/**
 * Fetch customizado que monitora Egress e tráfego com o Supabase de forma 100% não bloqueante
 */
const monitoredFetch: typeof fetch = async (input, init) => {
    const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;
    const method = (init?.method || (typeof input === 'object' && 'method' in input ? (input as Request).method : 'GET') || 'GET').toUpperCase();

    // Executa a requisição real
    const response = await fetch(input, init);

    // Telemetria assíncrona que não afeta performance da aplicação
    try {
        let table = 'outros';
        let operation: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'STORAGE' | 'REALTIME' = 'SELECT';

        if (urlStr.includes('/rest/v1/rpc/')) {
            const rpcName = urlStr.split('/rest/v1/rpc/')[1]?.split('?')[0] || 'rpc';
            table = `rpc:${rpcName}`;
            operation = 'SELECT';
        } else if (urlStr.includes('/rest/v1/')) {
            const pathPart = urlStr.split('/rest/v1/')[1]?.split('?')[0] || 'tabela';
            table = pathPart;
            if (method === 'GET') operation = 'SELECT';
            else if (method === 'POST') operation = 'INSERT';
            else if (method === 'PATCH' || method === 'PUT') operation = 'UPDATE';
            else if (method === 'DELETE') operation = 'DELETE';
        } else if (urlStr.includes('/storage/v1/')) {
            table = 'storage';
            operation = 'STORAGE';
        } else if (urlStr.includes('/auth/v1/')) {
            table = 'auth';
            operation = 'SELECT';
        }

        // Medição do tamanho retornado
        const contentLength = response.headers.get('content-length');
        if (contentLength) {
            const bytes = parseInt(contentLength, 10);
            egressMonitor.record(table, operation, isNaN(bytes) ? 300 : bytes, urlStr);
        } else {
            // Clona assincronamente a resposta para aferir tamanho real em bytes sem travar o stream
            response.clone().blob().then(blob => {
                egressMonitor.record(table, operation, blob.size, urlStr);
            }).catch(() => {
                egressMonitor.record(table, operation, 300, urlStr);
            });
        }
    } catch {
        // Silêncio em caso de exceção de telemetria
    }

    return response;
};

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
        global: {
            fetch: monitoredFetch
        },
        realtime: {
            params: {
                eventsPerSecond: 10
            }
        }
    }
);
