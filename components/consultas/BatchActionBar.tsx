import React from 'react';
import { ArrowRightLeft, XCircle, Trash2, Sparkles, PauseCircle, PlayCircle, X, RotateCcw, CheckSquare } from 'lucide-react';
import { ConsultaAgendamento } from '../../types';

interface BatchActionBarProps {
    selectedCount: number;
    totalFilteredCount: number;
    canTransfer: boolean;
    canCancel: boolean;
    canDelete: boolean;
    canPause: boolean;
    canEdit: boolean;
    onOpenTransfer: () => void;
    onOpenCancel: () => void;
    onOpenDelete: () => void;
    onOpenPriority: () => void;
    onOpenPauseResume: (mode: 'pause' | 'resume') => void;
    onDeselectAll: () => void;
    onExitSelectionMode: () => void;
}

export const BatchActionBar: React.FC<BatchActionBarProps> = ({
    selectedCount,
    totalFilteredCount,
    canTransfer,
    canCancel,
    canDelete,
    canPause,
    canEdit,
    onOpenTransfer,
    onOpenCancel,
    onOpenDelete,
    onOpenPriority,
    onOpenPauseResume,
    onDeselectAll,
    onExitSelectionMode
}) => {
    if (selectedCount === 0) return null;

    return (
        <aside
            role="toolbar"
            aria-label="Ações em lote para solicitações selecionadas"
            className="fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-[9990] w-[95vw] max-w-5xl animate-in slide-in-from-bottom-4 duration-300 pointer-events-auto"
        >
            <div className="bg-slate-900/95 backdrop-blur-md text-white border border-slate-700/90 rounded-2xl sm:rounded-3xl shadow-2xl p-2.5 sm:px-4 sm:py-3 flex flex-wrap items-center justify-between gap-2.5">
                {/* Esquerda: Contador de Seleção */}
                <div className="flex items-center gap-2 shrink-0">
                    <div className="w-8 h-8 rounded-xl bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-300">
                        <CheckSquare className="w-4 h-4" />
                    </div>
                    <div>
                        <div className="flex items-center gap-1.5">
                            <span className="px-2 py-0.5 rounded-lg bg-sky-500 text-white font-black text-xs tracking-wider">
                                {selectedCount}
                            </span>
                            <span className="text-xs font-black uppercase tracking-wider text-slate-200">
                                {selectedCount === 1 ? 'Solicitação Selecionada' : 'Solicitações Selecionadas'}
                            </span>
                        </div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider hidden sm:block">
                            de {totalFilteredCount} nos filtros ativos
                        </p>
                    </div>
                </div>

                {/* Centro: Ações em Lote */}
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-end flex-1 min-w-0">
                    {/* Transferir */}
                    {canTransfer && (
                        <button
                            type="button"
                            onClick={onOpenTransfer}
                            className="px-2.5 sm:px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-extrabold rounded-xl text-xs uppercase tracking-wider transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                            title="Transferir solicitações selecionadas para outro procedimento"
                        >
                            <ArrowRightLeft className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Transferir</span>
                        </button>
                    )}

                    {/* Alterar Prioridade */}
                    {canEdit && (
                        <button
                            type="button"
                            onClick={onOpenPriority}
                            className="px-2.5 sm:px-3 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 active:scale-95 text-white font-extrabold rounded-xl text-xs uppercase tracking-wider transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                            title="Alterar prioridade (Normal, Urgência ou Especial)"
                        >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span className="hidden md:inline">Prioridade</span>
                        </button>
                    )}

                    {/* Pausar / Retomar Fila */}
                    {canPause && (
                        <div className="inline-flex items-center rounded-xl bg-slate-800 border border-slate-700 p-0.5">
                            <button
                                type="button"
                                onClick={() => onOpenPauseResume('pause')}
                                className="px-2 py-1 text-amber-300 hover:text-white hover:bg-amber-600/60 rounded-lg text-[10.5px] font-black uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer"
                                title="Pausar solicitações em lote na fila"
                            >
                                <PauseCircle className="w-3 h-3" />
                                <span className="hidden lg:inline">Pausar</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => onOpenPauseResume('resume')}
                                className="px-2 py-1 text-emerald-300 hover:text-white hover:bg-emerald-600/60 rounded-lg text-[10.5px] font-black uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer"
                                title="Retomar solicitações pausadas em lote"
                            >
                                <PlayCircle className="w-3 h-3" />
                                <span className="hidden lg:inline">Retomar</span>
                            </button>
                        </div>
                    )}

                    {/* Cancelar */}
                    {canCancel && (
                        <button
                            type="button"
                            onClick={onOpenCancel}
                            className="px-2.5 sm:px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 active:scale-95 text-rose-300 hover:text-rose-200 font-extrabold rounded-xl text-xs uppercase tracking-wider transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                            title="Cancelar solicitações selecionadas com justificativa"
                        >
                            <XCircle className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Cancelar</span>
                        </button>
                    )}

                    {/* Excluir */}
                    {canDelete && (
                        <button
                            type="button"
                            onClick={onOpenDelete}
                            className="px-2.5 sm:px-3 py-1.5 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-extrabold rounded-xl text-xs uppercase tracking-wider transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                            title="Excluir solicitações selecionadas"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Excluir</span>
                        </button>
                    )}

                    {/* Desmarcar / Fechar Seleção */}
                    <div className="h-6 w-px bg-slate-700 mx-0.5" />

                    <button
                        type="button"
                        onClick={onDeselectAll}
                        className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
                        title="Desmarcar todas as solicitações"
                        aria-label="Desmarcar todas as solicitações"
                    >
                        <RotateCcw className="w-4 h-4" />
                    </button>

                    <button
                        type="button"
                        onClick={onExitSelectionMode}
                        className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
                        title="Cancelar modo de seleção"
                        aria-label="Cancelar seleção e fechar barra"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </aside>
    );
};
