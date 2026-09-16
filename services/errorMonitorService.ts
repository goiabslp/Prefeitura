/**
 * Serviço central de captura e monitoramento global de erros.
 * Intercepta exceções de runtime JS, unhandled promise rejections,
 * erros de renderização e erros reportados via console.error.
 */

import { sanitizeErrorText } from '../utils/sanitizerUtils';

export interface AppErrorEvent {
    id: string;
    message: string;
    errorType: string;
    route: string;
    timestamp: string;
    rawTimestamp: number;
    stack?: string;
    occurrences: number;
    details?: string;
}

type ErrorListener = (error: AppErrorEvent | null) => void;

class ErrorMonitorService {
    private currentError: AppErrorEvent | null = null;
    private listeners: Set<ErrorListener> = new Set();
    private recentFingerprints: Map<string, number> = new Map();
    private isInitialized = false;
    private isHandling = false;

    // Janela de deduplicação (5 segundos para agrupar erros idênticos)
    private readonly DEDUP_WINDOW_MS = 5000;

    /**
     * Inicializa os listeners globais no window e console
     */
    public init(): void {
        if (typeof window === 'undefined' || this.isInitialized) return;
        this.isInitialized = true;

        // 1. Captura de erros não tratados do JavaScript
        window.addEventListener('error', (event: ErrorEvent) => {
            // Ignora erros de scripts de terceiros ou extensões sem mensagem útil
            if (!event.message || event.message === 'Script error.') return;

            // Ignora erros comuns de redimensionamento de janela que não afetam a aplicação
            if (event.message.includes('ResizeObserver loop completed with undelivered notifications') ||
                event.message.includes('ResizeObserver loop limit exceeded')) {
                return;
            }

            this.captureError(event.error || event.message, {
                type: 'JavaScript Runtime Error',
                stack: event.error?.stack
            });
        });

        // 2. Captura de Promises rejeitadas sem tratamento (Unhandled Promise Rejection)
        window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
            const reason = event.reason;
            let message = 'Promise Rejeitada sem tratamento';
            let stack: string | undefined;

            if (reason instanceof Error) {
                message = reason.message;
                stack = reason.stack;
            } else if (typeof reason === 'string') {
                message = reason;
            } else if (reason && typeof reason === 'object') {
                message = reason.message || reason.error_description || JSON.stringify(reason);
                stack = reason.stack;
            }

            this.captureError(message, {
                type: 'Unhandled Promise Rejection',
                stack
            });
        });

        // 3. Interceptação transparente de console.error (mantém o log original)
        const originalConsoleError = console.error;
        console.error = (...args: any[]) => {
            // Executa sempre o console original do navegador
            originalConsoleError.apply(console, args);

            if (this.isHandling) return;

            try {
                this.isHandling = true;
                const firstArg = args[0];

                // Filtros de ruídos comuns de desenvolvimento que não devem disparar modal
                const stringified = args.map(a => typeof a === 'string' ? a : safeString(a)).join(' ');
                
                if (
                    stringified.includes('[vite]') ||
                    stringified.includes('Warning:') ||
                    stringified.includes('Download the React DevTools') ||
                    stringified.includes('ResizeObserver')
                ) {
                    return;
                }

                // Identifica erros do Supabase reportados via [Supabase Error] ou [consultasService] Error
                let errorType = 'Console Error';
                let message = '';
                let stack: string | undefined;

                if (stringified.includes('[Supabase Error]')) {
                    errorType = 'Erro de API / Supabase';
                }

                if (firstArg instanceof Error) {
                    message = firstArg.message;
                    stack = firstArg.stack;
                } else if (typeof firstArg === 'string') {
                    message = args.join(' ');
                } else {
                    message = safeString(firstArg);
                }

                // Só abre modal se houver uma mensagem de erro clara
                if (message && message.trim().length > 0) {
                    this.captureError(message, {
                        type: errorType,
                        stack
                    });
                }
            } catch {
                // Previne qualquer falha dentro do interceptor de console
            } finally {
                this.isHandling = false;
            }
        };
    }

    /**
     * Captura centralizada de erro, sanitiza e notifica a interface
     */
    public captureError(
        error: unknown, 
        context?: { type?: string; route?: string; stack?: string; details?: string }
    ): void {
        try {
            const now = Date.now();
            let rawMessage = '';
            let rawStack = context?.stack;

            if (error instanceof Error) {
                rawMessage = error.message;
                rawStack = rawStack || error.stack;
            } else if (typeof error === 'string') {
                rawMessage = error;
            } else if (error && typeof error === 'object') {
                rawMessage = (error as any).message || (error as any).error_description || safeString(error);
                rawStack = rawStack || (error as any).stack;
            } else {
                rawMessage = String(error);
            }

            // Ignorar mensagens vazias
            if (!rawMessage || rawMessage.trim() === '') return;

            // Rota atual no momento da ocorrência
            const currentRoute = context?.route || (typeof window !== 'undefined' 
                ? (window.location.pathname + window.location.search + window.location.hash) 
                : '/');

            const errorType = context?.type || 'Erro Inesperado';

            // Gerar fingerprint para agrupar erros repetitivos
            const fingerprint = `${errorType}:${rawMessage.trim().substring(0, 120)}:${currentRoute}`;
            const lastOccurrence = this.recentFingerprints.get(fingerprint);

            // Se for o mesmo erro ocorrendo em menos de DEDUP_WINDOW_MS
            if (this.currentError && this.currentError.message === sanitizeErrorText(rawMessage)) {
                this.currentError.occurrences += 1;
                this.currentError.timestamp = this.formatTimestamp(new Date());
                this.notify();
                return;
            }

            if (lastOccurrence && (now - lastOccurrence) < this.DEDUP_WINDOW_MS) {
                // Erro muito recente, já exibido
                return;
            }

            this.recentFingerprints.set(fingerprint, now);

            // Sanitização de segurança de dados confidenciais
            const sanitizedMessage = sanitizeErrorText(rawMessage);
            const sanitizedStack = rawStack ? sanitizeErrorText(rawStack) : undefined;
            const sanitizedDetails = context?.details ? sanitizeErrorText(context.details) : undefined;

            const errorEvent: AppErrorEvent = {
                id: Math.random().toString(36).substring(2, 9),
                message: sanitizedMessage,
                errorType,
                route: currentRoute,
                timestamp: this.formatTimestamp(new Date()),
                rawTimestamp: now,
                stack: sanitizedStack,
                occurrences: 1,
                details: sanitizedDetails
            };

            this.currentError = errorEvent;
            this.notify();
        } catch (err) {
            // Em caso de falha no monitor, não derrubar a aplicação
        }
    }

    /**
     * Fecha e limpa o erro atual exibido
     */
    public dismiss(): void {
        this.currentError = null;
        this.notify();
    }

    /**
     * Retorna o erro atualmente ativo
     */
    public getCurrentError(): AppErrorEvent | null {
        return this.currentError;
    }

    /**
     * Inscreve um ouvinte para atualizações do erro global
     */
    public subscribe(listener: ErrorListener): () => void {
        this.listeners.add(listener);
        listener(this.currentError);
        return () => {
            this.listeners.delete(listener);
        };
    }

    private notify(): void {
        this.listeners.forEach(cb => {
            try {
                cb(this.currentError);
            } catch {
                // Silencia erro em listener
            }
        });
    }

    private formatTimestamp(date: Date): string {
        const d = String(date.getDate()).padStart(2, '0');
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const y = date.getFullYear();
        const h = String(date.getHours()).padStart(2, '0');
        const min = String(date.getMinutes()).padStart(2, '0');
        const s = String(date.getSeconds()).padStart(2, '0');
        return `${d}/${m}/${y} ${h}:${min}:${s}`;
    }
}

const safeString = (val: any): string => {
    try {
        if (typeof val === 'object' && val !== null) {
            return JSON.stringify(val);
        }
        return String(val);
    } catch {
        return String(val);
    }
};

export const errorMonitor = new ErrorMonitorService();
