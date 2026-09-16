import React, { Component, ErrorInfo, ReactNode } from 'react';
import { errorMonitor } from '../../services/errorMonitorService';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class GlobalErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        // Notifica o serviço global de monitoramento de erro
        errorMonitor.captureError(error, {
            type: 'Erro de Renderização React',
            stack: errorInfo.componentStack || error.stack
        });
    }

    private handleReset = () => {
        this.setState({ hasError: false, error: null });
        errorMonitor.dismiss();
    };

    public render(): ReactNode {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen flex items-center justify-center p-6 bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-white">
                    <div className="max-w-md w-full p-6 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 text-center space-y-4">
                        <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto text-xl font-bold">
                            !
                        </div>
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                            Ops! Ocorreu um erro inesperado nesta visualização
                        </h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                            O erro foi registrado pelo sistema. Você pode tentar recarregar a visualização ou retornar ao início.
                        </p>
                        <div className="flex items-center justify-center gap-3 pt-2">
                            <button
                                onClick={this.handleReset}
                                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition"
                            >
                                Tentar novamente
                            </button>
                            <button
                                onClick={() => window.location.href = '/'}
                                className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-bold text-xs transition"
                            >
                                Ir para o Início
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
