/**
 * Camada de telemetria e monitoramento de tráfego/Egress com o Supabase.
 * Rastreia contagem de requisições, detecção de duplicatas e fontes de alto Egress.
 * Não armazena dados confidenciais.
 */

export const EGRESS_MONTHLY_LIMIT_GB = 250;
export const EGRESS_RESET_DAY = 15;

export interface EgressEvent {
    id: string;
    timestamp: number;
    table: string;
    operation: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'STORAGE' | 'REALTIME';
    estimatedBytes: number;
    isDuplicate?: boolean;
    endpoint?: string;
}

export interface EgressStats {
    totalRequests: number;
    duplicateCount: number;
    estimatedTotalBytes: number;
    estimatedTotalKb: number;
    estimatedTotalMb: number;
    estimatedTotalGb: number;
    formattedGb: string;
    tableCounts: Record<string, number>;
    operationCounts: Record<string, number>;
    recentEvents: EgressEvent[];
}

const MAX_HISTORY = 100;
const DUPLICATE_WINDOW_MS = 2000;
const STORAGE_KEY = 'sb_egress_telemetry_v1';

class EgressMonitorService {
    private events: EgressEvent[] = [];
    private listeners: Set<(stats: EgressStats) => void> = new Set();
    private tableCounts: Record<string, number> = {};
    private operationCounts: Record<string, number> = {};
    private totalEstimatedBytes = 0;
    private duplicateCount = 0;

    constructor() {
        this.loadFromStorage();
    }

    private loadFromStorage(): void {
        if (typeof window === 'undefined') return;
        try {
            const raw = sessionStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                this.events = parsed.events || [];
                this.tableCounts = parsed.tableCounts || {};
                this.operationCounts = parsed.operationCounts || {};
                this.totalEstimatedBytes = parsed.totalEstimatedBytes || 0;
                this.duplicateCount = parsed.duplicateCount || 0;
            }
        } catch {
            // Ignora erro de parsing em sessionStorage
        }
    }

    private saveToStorage(): void {
        if (typeof window === 'undefined') return;
        try {
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
                events: this.events.slice(0, 50),
                tableCounts: this.tableCounts,
                operationCounts: this.operationCounts,
                totalEstimatedBytes: this.totalEstimatedBytes,
                duplicateCount: this.duplicateCount
            }));
        } catch {
            // Ignora falha de cota em sessionStorage
        }
    }

    /**
     * Registra uma chamada efetuada ao Supabase
     */
    public record(
        table: string, 
        operation: EgressEvent['operation'], 
        estimatedBytes: number = 250,
        endpoint?: string
    ): void {
        const now = Date.now();
        const safeBytes = Math.max(50, Math.round(estimatedBytes));
        
        // Detecção de requisição idêntica na mesma tabela dentro da janela de tolerância de 2s
        const isDuplicate = this.events.some(
            e => e.table === table && e.operation === operation && (now - e.timestamp) < DUPLICATE_WINDOW_MS
        );

        if (isDuplicate) {
            this.duplicateCount++;
        }

        const event: EgressEvent = {
            id: Math.random().toString(36).substring(2, 9),
            timestamp: now,
            table,
            operation,
            estimatedBytes: safeBytes,
            isDuplicate,
            endpoint: endpoint ? endpoint.substring(0, 80) : undefined
        };

        this.events.unshift(event);
        if (this.events.length > MAX_HISTORY) {
            this.events.pop();
        }

        this.tableCounts[table] = (this.tableCounts[table] || 0) + 1;
        this.operationCounts[operation] = (this.operationCounts[operation] || 0) + 1;
        this.totalEstimatedBytes += safeBytes;

        this.saveToStorage();
        this.notify();
    }

    /**
     * Retorna as estatísticas consolidadas de Egress
     */
    public getStats(): EgressStats {
        const bytes = this.totalEstimatedBytes;
        const kb = bytes / 1024;
        const mb = kb / 1024;
        const gb = mb / 1024;

        // Formatação inteligente para exibição direta em GB
        let formattedGb = '0.0000';
        if (gb >= 1) {
            formattedGb = gb.toFixed(3);
        } else if (gb >= 0.01) {
            formattedGb = gb.toFixed(4);
        } else if (gb > 0) {
            formattedGb = gb.toFixed(5);
        }

        return {
            totalRequests: Object.values(this.tableCounts).reduce((a, b) => a + b, 0),
            duplicateCount: this.duplicateCount,
            estimatedTotalBytes: bytes,
            estimatedTotalKb: Math.round(kb * 10) / 10,
            estimatedTotalMb: Math.round(mb * 100) / 100,
            estimatedTotalGb: Number(gb.toFixed(6)),
            formattedGb,
            tableCounts: { ...this.tableCounts },
            operationCounts: { ...this.operationCounts },
            recentEvents: [...this.events]
        };
    }

    /**
     * Limpa o histórico de monitoramento
     */
    public reset(): void {
        this.events = [];
        this.tableCounts = {};
        this.operationCounts = {};
        this.totalEstimatedBytes = 0;
        this.duplicateCount = 0;
        if (typeof window !== 'undefined') {
            sessionStorage.removeItem(STORAGE_KEY);
        }
        this.notify();
    }

    /**
     * Inscreve um ouvinte para atualizações em tempo real das métricas
     */
    public subscribe(listener: (stats: EgressStats) => void): () => void {
        this.listeners.add(listener);
        listener(this.getStats());
        return () => {
            this.listeners.delete(listener);
        };
    }

    private notify(): void {
        if (this.listeners.size === 0) return;
        const stats = this.getStats();
        this.listeners.forEach(cb => {
            try {
                cb(stats);
            } catch (err) {
                console.error('[EgressMonitor] Listener error:', err);
            }
        });
    }
}

export const egressMonitor = new EgressMonitorService();
