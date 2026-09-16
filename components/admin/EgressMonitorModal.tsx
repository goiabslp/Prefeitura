import React, { useState, useEffect } from 'react';
import { egressMonitor, EgressStats } from '../../services/egressMonitorService';
import { Activity, ShieldCheck, RefreshCw, X, AlertTriangle, Database, ArrowDownCircle, Zap, Clock } from 'lucide-react';
import { supabase } from '../../services/supabaseClient';

interface EgressMonitorModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const EgressMonitorModal: React.FC<EgressMonitorModalProps> = ({ isOpen, onClose }) => {
    const [stats, setStats] = useState<EgressStats>(() => egressMonitor.getStats());
    const [isTesting, setIsTesting] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        // Atualiza imediatamente com dados atuais
        setStats(egressMonitor.getStats());

        // Inscreve para atualizações em tempo real
        const unsubscribe = egressMonitor.subscribe(newStats => {
            setStats(newStats);
        });
        return () => unsubscribe();
    }, [isOpen]);

    // Função de teste rápido para validar a telemetria em tempo real
    const handleTriggerTest = async () => {
        setIsTesting(true);
        try {
            // Executa uma consulta leve para registrar no monitor
            await supabase.from('users').select('id, name').limit(1);
        } catch {
            // Ignora erro eventual de permissão
        } finally {
            setIsTesting(false);
        }
    };

    if (!isOpen) return null;

    const topTables = Object.entries(stats.tableCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8);

    const getOperationBadge = (op: string) => {
        switch (op) {
            case 'SELECT':
                return 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-900';
            case 'INSERT':
                return 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900';
            case 'UPDATE':
                return 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900';
            case 'DELETE':
                return 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900';
            default:
                return 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700';
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
                            <Activity className="w-5 h-5 animate-pulse" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                Monitor de Tráfego & Egress (Supabase)
                                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-medium">
                                    Ativo em Tempo Real
                                </span>
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                Diagnóstico de consumo de rede, requisições e detecção de duplicatas
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-800 transition"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto space-y-6">
                    {/* Cards de Métricas Principais */}
                    <div className="grid grid-cols-3 gap-4">
                        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
                                <span className="text-xs font-medium">Total de Requisições</span>
                                <Database className="w-4 h-4 text-blue-500" />
                            </div>
                            <div className="text-2xl font-black text-slate-900 dark:text-white">
                                {stats.totalRequests}
                            </div>
                            <div className="text-[10px] text-slate-400 mt-1">Sessão atual ativa</div>
                        </div>

                        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
                                <span className="text-xs font-medium">Consumo de Egress</span>
                                <ArrowDownCircle className="w-4 h-4 text-emerald-500" />
                            </div>
                            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono tracking-tight flex items-baseline gap-1">
                                <span>{stats.formattedGb}</span>
                                <span className="text-sm font-bold uppercase">GB</span>
                            </div>
                            <div className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 mt-1 flex items-center justify-between">
                                <span>{stats.estimatedTotalMb} MB ({stats.estimatedTotalKb} KB)</span>
                                <span className="text-slate-400">Cota: 5 GB</span>
                            </div>
                        </div>

                        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
                                <span className="text-xs font-medium">Chamadas Duplicadas</span>
                                <AlertTriangle className="w-4 h-4 text-amber-500" />
                            </div>
                            <div className={`text-2xl font-black ${stats.duplicateCount === 0 ? 'text-emerald-500' : 'text-amber-500'}`}>
                                {stats.duplicateCount}
                            </div>
                            <div className="text-[10px] text-slate-400 mt-1">
                                {stats.duplicateCount === 0 ? 'Zero duplicadas detectadas' : 'Evitadas pelo cache'}
                            </div>
                        </div>
                    </div>

                    {/* Barra de Progresso da Cota de Egress (5.00 GB) */}
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                Limite de Egress (Plano Supabase): 5.00 GB
                            </span>
                            <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                                {((stats.estimatedTotalGb / 5) * 100).toFixed(3)}% da cota
                            </span>
                        </div>
                        <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500 rounded-full"
                                style={{ width: `${Math.min(100, Math.max(0.5, (stats.estimatedTotalGb / 5) * 100))}%` }}
                            ></div>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-400">
                            <span>{stats.formattedGb} GB consumidos nesta sessão</span>
                            <span>{Math.max(0, 5 - stats.estimatedTotalGb).toFixed(4)} GB disponíveis</span>
                        </div>
                    </div>

                    {/* Regras Ativas de Otimização */}
                    <div className="p-4 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50">
                        <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-semibold text-sm mb-2">
                            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                            Diretrizes de Egress Rigorosamente Aplicadas
                        </div>
                        <ul className="text-xs text-emerald-700 dark:text-emerald-400 space-y-1">
                            <li>✓ Proibição de <code className="bg-emerald-100 dark:bg-emerald-900/50 px-1 rounded">select('*')</code> em consultas ativas.</li>
                            <li>✓ Polling em loop de 3s em Licitações eliminado com sucesso.</li>
                            <li>✓ React Query com <code className="bg-emerald-100 dark:bg-emerald-900/50 px-1 rounded">refetchOnMount: false</code> e 10 min de stale time.</li>
                            <li>✓ Filtros de data, procedimento e status aplicados diretamente no banco de dados.</li>
                            <li>✓ Canais WebSocket globais consolidados e sem conexões duplicadas.</li>
                        </ul>
                    </div>

                    {/* Tabelas Mais Consultadas */}
                    <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                            <Zap className="w-3.5 h-3.5" /> Tabelas com Mais Consultas
                        </h4>
                        {topTables.length === 0 ? (
                            <p className="text-xs text-slate-400 italic">Nenhuma requisição registrada ainda nesta sessão.</p>
                        ) : (
                            <div className="grid grid-cols-2 gap-2">
                                {topTables.map(([table, count]) => (
                                    <div key={table} className="flex items-center justify-between text-xs p-2 rounded-lg bg-slate-50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800">
                                        <span className="font-mono font-medium text-slate-700 dark:text-slate-300 truncate max-w-[140px]">{table}</span>
                                        <span className="font-semibold px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px]">
                                            {count} {count === 1 ? 'req' : 'reqs'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Últimas Requisições (Feed em Tempo Real) */}
                    <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5" /> Requisições Recentes
                        </h4>
                        {stats.recentEvents.length === 0 ? (
                            <p className="text-xs text-slate-400 italic">As requisições ao Supabase aparecerão aqui conforme você navegar no sistema.</p>
                        ) : (
                            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                {stats.recentEvents.slice(0, 15).map(event => (
                                    <div 
                                        key={event.id}
                                        className={`flex items-center justify-between p-2 rounded-lg text-xs border ${
                                            event.isDuplicate 
                                                ? 'bg-amber-500/5 border-amber-500/20' 
                                                : 'bg-slate-50 dark:bg-slate-800/20 border-slate-100 dark:border-slate-800/60'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2 truncate">
                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${getOperationBadge(event.operation)}`}>
                                                {event.operation}
                                            </span>
                                            <span className="font-mono font-medium text-slate-800 dark:text-slate-200 truncate">
                                                {event.table}
                                            </span>
                                            {event.isDuplicate && (
                                                <span className="text-[10px] text-amber-500 font-semibold bg-amber-500/10 px-1 rounded">
                                                    duplicada
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-3 shrink-0 text-slate-400 text-[11px]">
                                            <span className="font-mono text-emerald-600 dark:text-emerald-400 font-medium">
                                                {event.estimatedBytes > 1024 
                                                    ? `${(event.estimatedBytes / 1024).toFixed(1)} KB`
                                                    : `${event.estimatedBytes} B`}
                                            </span>
                                            <span>
                                                {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/30">
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => egressMonitor.reset()}
                            className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1 transition"
                        >
                            <RefreshCw className="w-3.5 h-3.5" /> Zerar Contador
                        </button>
                        <button
                            type="button"
                            disabled={isTesting}
                            onClick={handleTriggerTest}
                            className="text-xs text-indigo-500 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-1 transition disabled:opacity-50"
                        >
                            <Zap className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} /> Testar Consulta
                        </button>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-1.5 text-xs font-medium rounded-lg bg-slate-800 dark:bg-slate-700 text-white hover:bg-slate-700 transition cursor-pointer"
                    >
                        Fechar
                    </button>
                </div>

            </div>
        </div>
    );
};
