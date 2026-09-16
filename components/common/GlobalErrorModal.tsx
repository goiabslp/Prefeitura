import React, { useState, useEffect, useCallback } from 'react';
import { errorMonitor, AppErrorEvent } from '../../services/errorMonitorService';
import { AlertOctagon, Copy, Check, X, ChevronDown, ChevronUp, Clock, MapPin, Layers } from 'lucide-react';

export const GlobalErrorModal: React.FC = () => {
    const [currentError, setCurrentError] = useState<AppErrorEvent | null>(() => errorMonitor.getCurrentError());
    const [isCopied, setIsCopied] = useState(false);
    const [showStack, setShowStack] = useState(false);

    useEffect(() => {
        const unsubscribe = errorMonitor.subscribe(error => {
            setCurrentError(error);
            setIsCopied(false);
            setShowStack(false);
        });
        return () => unsubscribe();
    }, []);

    // Fechar com a tecla ESC
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && currentError) {
                errorMonitor.dismiss();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentError]);

    const handleCopy = useCallback(async () => {
        if (!currentError) return;

        // Formatação estruturada conforme solicitado pelo usuário
        const textToCopy = [
            'ERRO DETECTADO',
            '',
            `Rota: ${currentError.route}`,
            `Data/Hora: ${currentError.timestamp}`,
            currentError.errorType ? `Tipo: ${currentError.errorType}` : '',
            currentError.occurrences > 1 ? `Repetições detectadas: ${currentError.occurrences}` : '',
            '',
            'Mensagem:',
            currentError.message,
            '',
            currentError.stack ? `Stack:\n${currentError.stack}` : ''
        ].filter(line => line !== '').join('\n');

        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(textToCopy);
            } else {
                // Fallback para navegadores sem clipboard API direta
                const textArea = document.createElement('textarea');
                textArea.value = textToCopy;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
            }

            setIsCopied(true);
            setTimeout(() => {
                setIsCopied(false);
            }, 2500);
        } catch {
            // Em caso de bloqueio de permissão de clipboard
        }
    }, [currentError]);

    if (!currentError) return null;

    return (
        <div 
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm animate-in fade-in duration-200"
            role="dialog"
            aria-modal="true"
            aria-labelledby="error-modal-title"
        >
            <div 
                className="bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/60 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150"
                onClick={e => e.stopPropagation()}
            >
                {/* Cabeçalho */}
                <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-rose-50/70 dark:bg-rose-950/30 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-xl">
                            <AlertOctagon className="w-5 h-5 animate-pulse" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 id="error-modal-title" className="text-base font-bold text-slate-900 dark:text-white">
                                    Erro detectado
                                </h3>
                                {currentError.occurrences > 1 && (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500 text-white animate-bounce">
                                        {currentError.occurrences}x ocorrências
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-rose-700/80 dark:text-rose-400/80">
                                Ocorrência capturada pelo monitor do sistema
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={() => errorMonitor.dismiss()}
                        className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-800 transition"
                        title="Fechar (Esc)"
                        aria-label="Fechar"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Metadados do Erro (Rota, Data/Hora, Tipo) */}
                <div className="px-6 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200/80 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                    <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 min-w-0">
                        <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                        <span className="font-semibold shrink-0">Rota:</span>
                        <span className="font-mono text-slate-800 dark:text-slate-200 truncate" title={currentError.route}>
                            {currentError.route}
                        </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                        <Clock className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                        <span className="font-semibold">Data/Hora:</span>
                        <span className="font-mono text-slate-800 dark:text-slate-200">
                            {currentError.timestamp}
                        </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 min-w-0">
                        <Layers className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span className="font-semibold shrink-0">Tipo:</span>
                        <span className="truncate px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-[11px] font-medium" title={currentError.errorType}>
                            {currentError.errorType}
                        </span>
                    </div>
                </div>

                {/* Conteúdo do Erro */}
                <div className="p-6 overflow-y-auto space-y-4">
                    {/* Mensagem Principal */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            Mensagem:
                        </label>
                        <div className="p-3.5 rounded-xl bg-slate-900 text-rose-300 font-mono text-xs leading-relaxed break-words whitespace-pre-wrap selection:bg-rose-500 selection:text-white border border-slate-800 max-h-80 overflow-y-auto shadow-inner">
                            {currentError.message}
                        </div>
                    </div>

                    {/* Stack Trace Opcional */}
                    {currentError.stack && (
                        <div className="space-y-1.5 pt-1">
                            <button
                                type="button"
                                onClick={() => setShowStack(!showStack)}
                                className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 transition"
                            >
                                {showStack ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                <span>{showStack ? 'Ocultar Stack Trace' : 'Ver Detalhes Técnicos (Stack Trace)'}</span>
                            </button>

                            {showStack && (
                                <div className="p-3.5 rounded-xl bg-slate-950 text-slate-300 font-mono text-[11px] leading-relaxed overflow-x-auto max-h-48 border border-slate-800 whitespace-pre">
                                    {currentError.stack}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Rodapé de Ações */}
                <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
                    <p className="text-[11px] text-slate-400 dark:text-slate-500">
                        Pressione <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-mono text-[10px]">Esc</kbd> ou clique em Fechar para continuar.
                    </p>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handleCopy}
                            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm ${
                                isCopied
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700'
                            }`}
                        >
                            {isCopied ? (
                                <>
                                    <Check className="w-4 h-4 text-white" />
                                    <span>Erro copiado</span>
                                </>
                            ) : (
                                <>
                                    <Copy className="w-4 h-4" />
                                    <span>Copiar erro</span>
                                </>
                            )}
                        </button>

                        <button
                            type="button"
                            onClick={() => errorMonitor.dismiss()}
                            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white text-xs font-bold transition shadow-sm"
                        >
                            Fechar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
