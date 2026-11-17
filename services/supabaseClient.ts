/// <reference types="vite/client" />

import { createClient } from '@supabase/supabase-js';
import { egressMonitor } from './egressMonitorService';
import { sessionLifecycleService } from './sessionLifecycleService';

const supabaseUrl = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SUPABASE_URL) || (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL) || '';
const supabaseAnonKey = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SUPABASE_ANON_KEY) || (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_ANON_KEY) || '';

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase URL and Anon Key missing! Authentication will not work properly.');
}

/**
 * Fetch customizado que monitora Egress e valida a vigência da sessão de 4 horas
 */
const monitoredFetch: typeof fetch = async (input, init) => {
    const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;
    const method = (init?.method || (typeof input === 'object' && 'method' in input ? (input as Request).method : 'GET') || 'GET').toUpperCase();

    // SEGURANÇA EM BACKEND: Se a operação for em dados protegidos e a sessão de 4 horas tiver expirado, rejeita com 401
    const isProtectedSupabaseResource = urlStr.includes('/rest/v1/') || urlStr.includes('/storage/v1/');
    const isAuthGrantCall = urlStr.includes('/auth/v1/token') || urlStr.includes('/auth/v1/recover');

    if (isProtectedSupabaseResource && !isAuthGrantCall) {
        const sessionCheck = sessionLifecycleService.isSessionValid();
        if (!sessionCheck.isValid && sessionCheck.reason === 'expired_4h') {
            console.warn('[SupabaseClient] Requisição protegida rejeitada: sessão expirada após 4 horas.');
            sessionLifecycleService.expireSession();
            return new Response(
                JSON.stringify({
                    code: 'SESSION_EXPIRED',
                    message: 'Sua sessão expirou após 4 horas. Faça login novamente para continuar.'
                }),
                {
                    status: 401,
                    statusText: 'Unauthorized',
                    headers: { 'Content-Type': 'application/json' }
                }
            );
        }
    }

    // Executa a requisição real
    const response = await fetch(input, init);

    // Sincroniza o relógio do cliente com o relógio oficial do servidor Supabase via header Date
    const serverDateHeader = response.headers.get('date');
    if (serverDateHeader) {
        sessionLifecycleService.syncServerTime(serverDateHeader);
    }

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
    supabaseUrl || 'https://placeholder-project.supabase.co',
    supabaseAnonKey || 'placeholder-key',
    {
        auth: {
            persistSession: true,
            storage: typeof window !== 'undefined' ? window.localStorage : undefined,
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
