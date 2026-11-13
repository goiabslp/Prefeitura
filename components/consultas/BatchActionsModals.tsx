import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { 
    X, ArrowRightLeft, XCircle, Trash2, Sparkles, PauseCircle, PlayCircle, 
    AlertTriangle, CheckCircle2, Loader2, Search, Filter, ShieldAlert, ShieldCheck, Check
} from 'lucide-react';
import { ConsultaAgendamento, ConsultaProcedimento, User } from '../../types';
import { formatProcedimentoLabel } from '../../services/consultasService';
import { formatPatientName } from '../common/PacientesTab';

// ==================== MODAL DE TRANSFERÊNCIA EM LOTE ====================

interface BatchTransferModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedBookings: ConsultaAgendamento[];
    procedures: ConsultaProcedimento[];
    onConfirmTransfer: (params: {
        targetProcedimentoId: string;
        preserveSolicitationDate: boolean;
        preservePriority: boolean;
        reason: string;
    }) => Promise<void>;
    isProcessing: boolean;
    progress: { current: number; total: number } | null;
}

export const BatchTransferModal: React.FC<BatchTransferModalProps> = ({
    isOpen,
    onClose,
    selectedBookings,
    procedures,
    onConfirmTransfer,
    isProcessing,
    progress
}) => {
    const [targetProcId, setTargetProcId] = useState('');
    const [searchProc, setSearchProc] = useState('');
    const [typeFilter, setTypeFilter] = useState<'TODOS' | 'Consulta' | 'Exame' | 'Cirurgia'>('TODOS');
    const [reason, setReason] = useState('');
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const filteredProcs = procedures.filter(p => {
        // REGRA DE SUSPENSÃO: Apenas procedimentos ativos podem ser destinos de transferência
        if (p.status !== 'Ativo') return false;
        if (p.parent_id) {
            const parent = procedures.find(parentProc => parentProc.id === p.parent_id);
            if (parent && parent.status !== 'Ativo') return false;
        }
        const matchesType = typeFilter === 'TODOS' || p.type === typeFilter;
        const label = formatProcedimentoLabel(p).toLowerCase();
        const code = (p.code || '').toLowerCase();
        const q = searchProc.toLowerCase().trim();
        const matchesSearch = !q || label.includes(q) || code.includes(q);
        return matchesType && matchesSearch;
    });

    const selectedTargetProc = procedures.find(p => p.id === targetProcId);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!targetProcId) {
            setError('Por favor, selecione o procedimento de destino para a transferência.');
            return;
        }

        // REGRA DE SUSPENSÃO: Validar se o procedimento de destino está ativo no momento da confirmação
        if (selectedTargetProc && selectedTargetProc.status !== 'Ativo') {
            setError(`O procedimento "${formatProcedimentoLabel(selectedTargetProc)}" está suspenso e não pode receber transferências.`);
            return;
        }

        if (selectedTargetProc && selectedTargetProc.parent_id) {
            const parent = procedures.find(p => p.id === selectedTargetProc.parent_id);
            if (parent && parent.status !== 'Ativo') {
                setError(`O procedimento principal "${parent.name}" está suspenso e não pode receber transferências.`);
                return;
            }
        }

        try {
            // REGRA OBRIGATÓRIA: Preservação automática de data original, prioridade, status e agendamento
            await onConfirmTransfer({
                targetProcedimentoId: targetProcId,
                preserveSolicitationDate: true,
                preservePriority: true,
                reason: reason.trim()
            });
        } catch (err: any) {
            setError(err.message || 'Erro ao realizar transferência em lote.');
        }
    };

    const progressPercentage = progress && progress.total > 0
        ? Math.round((progress.current / progress.total) * 100)
        : 0;

    return typeof document !== 'undefined' ? createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="p-4 sm:p-5 border-b border-indigo-100 bg-gradient-to-r from-indigo-50/80 via-purple-50/40 to-white flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-700 shadow-inner">
                            <ArrowRightLeft className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-sm sm:text-base font-black text-slate-900 uppercase tracking-tight">
                                    Transferência em Lote
                                </h3>
                                <span className="px-2.5 py-0.5 rounded-full bg-indigo-600 text-white font-black text-[10px] tracking-wider">
                                    {selectedBookings.length} {selectedBookings.length === 1 ? 'ITEM' : 'ITENS'}
                                </span>
                            </div>
                            <p className="text-[11px] text-slate-500 font-semibold mt-0.5">
                                Transfere todas as solicitações selecionadas para um novo procedimento
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isProcessing}
                        className="p-1.5 hover:bg-slate-200/80 rounded-xl text-slate-400 hover:text-slate-700 transition-colors cursor-pointer disabled:opacity-40"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto custom-scrollbar flex-1 space-y-4">
                    {/* Alerta de erro */}
                    {error && (
                        <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-2.5 text-rose-800 text-xs font-bold animate-in fade-in">
                            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Barra de Progresso */}
                    {isProcessing && (
                        <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-2xl space-y-2">
                            <div className="flex justify-between items-center text-xs font-bold text-indigo-900">
                                <span className="flex items-center gap-1.5">
                                    <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                                    Processando transferência em lote...
                                </span>
                                <span>{progress?.current || 0} de {progress?.total || selectedBookings.length} ({progressPercentage}%)</span>
                            </div>
                            <div className="w-full bg-indigo-200/70 h-2.5 rounded-full overflow-hidden">
                                <div
                                    className="bg-indigo-600 h-full transition-all duration-200 rounded-full"
                                    style={{ width: `${progressPercentage}%` }}
                                />
                            </div>
                        </div>
                    )}

                    {/* Resumo das solicitações selecionadas */}
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 space-y-2">
                        <div className="flex justify-between items-center text-[10.5px] font-black uppercase tracking-wider text-slate-400">
                            <span>Solicitações a transferir ({selectedBookings.length})</span>
                            <span>Lista resumida</span>
                        </div>
                        <div className="max-h-28 overflow-y-auto custom-scrollbar space-y-1.5 pr-1">
                            {selectedBookings.map((b) => (
                                <div key={b.id} className="text-xs flex items-center justify-between gap-2 p-1.5 bg-white rounded-xl border border-slate-200/70">
                                    <div className="min-w-0 flex-1 truncate">
                                        <span className="font-extrabold text-slate-800">
                                            {b.paciente ? formatPatientName(b.paciente) : 'Paciente'}
                                        </span>
                                        <span className="text-slate-400 text-[10.5px] block truncate">
                                            Procedimento atual: {formatProcedimentoLabel(b.procedimento)}
                                        </span>
                                    </div>
                                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[9px] font-bold shrink-0 uppercase">
                                        {b.status || 'Solicitado'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Procedimento de Destino */}
                    <div className="space-y-2">
                        <label className="block text-xs font-black uppercase tracking-wider text-slate-700">
                            Selecione o Procedimento de Destino <span className="text-rose-500">*</span>
                        </label>

                        {/* Filtros de Tipo */}
                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
                            {(['TODOS', 'Consulta', 'Exame', 'Cirurgia'] as const).map(t => (
                                <button
                                    key={t}
                                    type="button"
                                    onClick={() => setTypeFilter(t)}
                                    className={`px-3 py-1 rounded-xl text-[10.5px] font-black uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
                                        typeFilter === t
                                            ? 'bg-indigo-600 text-white shadow-xs'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200/60'
                                    }`}
                                >
                                    {t}
                                </button>
                            ))}
                        </div>

                        {/* Campo de Busca no Seletor */}
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Filtrar por nome do procedimento, código ou especialista..."
                                value={searchProc}
                                onChange={(e) => setSearchProc(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-semibold focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all text-slate-800 placeholder:text-slate-400"
                            />
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        </div>

                        {/* Lista de Seleção do Procedimento */}
                        <div className="max-h-56 overflow-y-auto custom-scrollbar border border-slate-200 rounded-2xl divide-y divide-slate-100 bg-white shadow-inner">
                            {filteredProcs.length === 0 ? (
                                <div className="p-4 text-center text-xs text-slate-400 font-bold uppercase tracking-wider">
                                    Nenhum procedimento encontrado
                                </div>
                            ) : (
                                filteredProcs.map(proc => {
                                    const isSelected = targetProcId === proc.id;
                                    return (
                                        <div
                                            key={proc.id}
                                            onClick={() => setTargetProcId(proc.id)}
                                            className={`p-2.5 px-3 flex items-center justify-between gap-3 cursor-pointer transition-all ${
                                                isSelected
                                                    ? 'bg-indigo-50/80 border-l-4 border-indigo-600'
                                                    : 'hover:bg-slate-50'
                                            }`}
                                        >
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-1.5">
                                                    {proc.code && (
                                                        <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-slate-100 text-slate-700 font-mono">
                                                            {proc.code}
                                                        </span>
                                                    )}
                                                    <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded ${
                                                        proc.type === 'Exame' ? 'bg-sky-50 text-sky-700' :
                                                        proc.type === 'Consulta' ? 'bg-indigo-50 text-indigo-700' : 'bg-rose-50 text-rose-700'
                                                    }`}>
                                                        {proc.type}
                                                    </span>
                                                </div>
                                                <p className="text-xs font-black text-slate-800 uppercase mt-0.5 truncate">
                                                    {formatProcedimentoLabel(proc)}
                                                </p>
                                            </div>
                                            {isSelected && (
                                                <div className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                                                    <Check className="w-3 h-3 stroke-[3]" />
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* Motivo Opcional */}
                    <div className="space-y-1">
                        <label className="block text-[10.5px] font-black uppercase tracking-wider text-slate-500">
                            Motivo / Justificativa (Opcional para auditoria)
                        </label>
                        <textarea
                            rows={2}
                            placeholder="Informe o motivo da transferência em lote (ex.: readequação de agenda médica)..."
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all text-slate-800 placeholder:text-slate-400"
                        />
                    </div>

                    {/* Footer / Botões */}
                    <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-end gap-2.5 shrink-0">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isProcessing}
                            className="w-full sm:w-auto px-4 py-2 border border-slate-200 hover:bg-slate-100 rounded-xl text-xs font-extrabold text-slate-600 uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-40"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isProcessing || !targetProcId}
                            className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 hover:from-indigo-500 hover:to-purple-600 text-white font-black rounded-xl text-xs uppercase tracking-wider transition-all shadow-md shadow-indigo-600/25 flex items-center justify-center gap-2 active:scale-95 cursor-pointer disabled:opacity-50"
                        >
                            {isProcessing ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>Transferindo ({progress?.current || 0}/{selectedBookings.length})...</span>
                                </>
                            ) : (
                                <>
                                    <ArrowRightLeft className="w-4 h-4" />
                                    <span>Confirmar Transferência em Lote</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    ) : null;
};

// ==================== MODAL DE CANCELAMENTO EM LOTE ====================

interface BatchCancelModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedCount: number;
    isGestorOrAdmin: boolean;
    onConfirmCancel: (reason: string) => Promise<void>;
    isProcessing: boolean;
    progress: { current: number; total: number } | null;
}

export const BatchCancelModal: React.FC<BatchCancelModalProps> = ({
    isOpen,
    onClose,
    selectedCount,
    isGestorOrAdmin,
    onConfirmCancel,
    isProcessing,
    progress
}) => {
    const [reason, setReason] = useState('');
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!reason.trim() || reason.trim().length < 5) {
            setError('A justificativa é obrigatória (mínimo de 5 caracteres).');
            return;
        }

        try {
            await onConfirmCancel(reason.trim());
        } catch (err: any) {
            setError(err.message || 'Erro ao cancelar em lote.');
        }
    };

    const progressPercentage = progress && progress.total > 0
        ? Math.round((progress.current / progress.total) * 100)
        : 0;

    return typeof document !== 'undefined' ? createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden border border-rose-200 flex flex-col animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="p-4 sm:p-5 border-b border-rose-100 bg-gradient-to-r from-rose-50/80 via-amber-50/40 to-white flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-rose-100 border border-rose-200 flex items-center justify-center text-rose-700 shadow-inner">
                            <XCircle className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-sm sm:text-base font-black text-rose-950 uppercase tracking-tight">
                                    {isGestorOrAdmin ? 'Cancelamento em Lote' : 'Solicitar Cancelamento em Lote'}
                                </h3>
                                <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white font-black text-[10px] tracking-wider">
                                    {selectedCount} {selectedCount === 1 ? 'ITEM' : 'ITENS'}
                                </span>
                            </div>
                            <p className="text-[11px] text-rose-800 font-semibold mt-0.5">
                                {isGestorOrAdmin
                                    ? 'Cancelamento imediato das solicitações selecionadas'
                                    : 'Envia solicitações de cancelamento para validação da Regulação'}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isProcessing}
                        className="p-1.5 hover:bg-slate-200/80 rounded-xl text-slate-400 hover:text-slate-700 transition-colors cursor-pointer disabled:opacity-40"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
                    {error && (
                        <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-2.5 text-rose-800 text-xs font-bold animate-in fade-in">
                            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    {isProcessing && (
                        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl space-y-2">
                            <div className="flex justify-between items-center text-xs font-bold text-rose-900">
                                <span className="flex items-center gap-1.5">
                                    <Loader2 className="w-4 h-4 animate-spin text-rose-600" />
                                    Cancelando solicitações em lote...
                                </span>
                                <span>{progress?.current || 0} de {progress?.total || selectedCount} ({progressPercentage}%)</span>
                            </div>
                            <div className="w-full bg-rose-200/70 h-2.5 rounded-full overflow-hidden">
                                <div
                                    className="bg-rose-600 h-full transition-all duration-200 rounded-full"
                                    style={{ width: `${progressPercentage}%` }}
                                />
                            </div>
                        </div>
                    )}

                    <div className="space-y-1.5">
                        <label className="block text-xs font-black uppercase tracking-wider text-slate-700">
                            Justificativa Obrigatória <span className="text-rose-500">*</span>
                        </label>
                        <textarea
                            rows={3}
                            required
                            placeholder="Informe detalhadamente a justificativa do cancelamento em lote..."
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs font-semibold focus:bg-white focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 transition-all text-slate-900 placeholder:text-slate-400"
                        />
                        <p className="text-[10px] text-slate-400">Mínimo de 5 caracteres. Registrado em auditoria.</p>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-end gap-2.5">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isProcessing}
                            className="w-full sm:w-auto px-4 py-2 border border-slate-200 hover:bg-slate-100 rounded-xl text-xs font-extrabold text-slate-600 uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-40"
                        >
                            Voltar
                        </button>
                        <button
                            type="submit"
                            disabled={isProcessing || !reason.trim() || reason.trim().length < 5}
                            className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white font-black rounded-xl text-xs uppercase tracking-wider transition-all shadow-md shadow-rose-600/25 flex items-center justify-center gap-2 active:scale-95 cursor-pointer disabled:opacity-50"
                        >
                            {isProcessing ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>Processando ({progress?.current || 0}/{selectedCount})...</span>
                                </>
                            ) : (
                                <>
                                    <XCircle className="w-4 h-4" />
                                    <span>Confirmar Cancelamento em Lote</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    ) : null;
};

// ==================== MODAL DE EXCLUSÃO EM LOTE ====================

interface BatchDeleteModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedCount: number;
    onConfirmDelete: () => Promise<void>;
    isProcessing: boolean;
    progress: { current: number; total: number } | null;
}

export const BatchDeleteModal: React.FC<BatchDeleteModalProps> = ({
    isOpen,
    onClose,
    selectedCount,
    onConfirmDelete,
    isProcessing,
    progress
}) => {
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const handleConfirm = async () => {
        setError('');
        try {
            await onConfirmDelete();
        } catch (err: any) {
            setError(err.message || 'Erro ao excluir em lote.');
        }
    };

    const progressPercentage = progress && progress.total > 0
        ? Math.round((progress.current / progress.total) * 100)
        : 0;

    return typeof document !== 'undefined' ? createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden border border-rose-300 flex flex-col animate-in zoom-in-95 duration-200">
                <div className="p-4 sm:p-5 border-b border-rose-100 bg-rose-50/80 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-rose-600/30">
                        <Trash2 className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-sm sm:text-base font-black text-rose-950 uppercase tracking-tight">
                            Exclusão em Lote
                        </h3>
                        <p className="text-[11px] text-rose-800 font-bold uppercase tracking-wider">
                            Ação definitiva e irreversível
                        </p>
                    </div>
                </div>

                <div className="p-5 space-y-4">
                    {error && (
                        <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs font-bold flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 text-xs space-y-1">
                        <p className="font-extrabold flex items-center gap-1.5">
                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                            Atenção: Exclusão de {selectedCount} registro(s)
                        </p>
                        <p className="text-[11px] text-amber-800">
                            Esta ação removerá permanentemente as solicitações selecionadas e atualizará as posições da fila de espera.
                        </p>
                    </div>

                    {isProcessing && (
                        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl space-y-2">
                            <div className="flex justify-between items-center text-xs font-bold text-rose-900">
                                <span className="flex items-center gap-1.5">
                                    <Loader2 className="w-4 h-4 animate-spin text-rose-600" />
                                    Excluindo solicitações em lote...
                                </span>
                                <span>{progress?.current || 0} de {progress?.total || selectedCount} ({progressPercentage}%)</span>
                            </div>
                            <div className="w-full bg-rose-200/70 h-2.5 rounded-full overflow-hidden">
                                <div
                                    className="bg-rose-600 h-full transition-all duration-200 rounded-full"
                                    style={{ width: `${progressPercentage}%` }}
                                />
                            </div>
                        </div>
                    )}

                    <div className="flex items-center justify-end gap-2.5 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isProcessing}
                            className="px-4 py-2 border border-slate-200 hover:bg-slate-100 rounded-xl text-xs font-extrabold text-slate-600 uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-40"
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            onClick={handleConfirm}
                            disabled={isProcessing}
                            className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-xl text-xs uppercase tracking-wider transition-all shadow-md shadow-rose-600/30 flex items-center gap-2 active:scale-95 cursor-pointer disabled:opacity-50"
                        >
                            {isProcessing ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>Excluindo...</span>
                                </>
                            ) : (
                                <>
                                    <Trash2 className="w-4 h-4" />
                                    <span>Confirmar Exclusão ({selectedCount})</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    ) : null;
};

// ==================== MODAL DE ALTERAÇÃO DE PRIORIDADE EM LOTE ====================

interface BatchPriorityModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedCount: number;
    onConfirmPriority: (priority: 'Normal' | 'Urgência' | 'Especial') => Promise<void>;
    isProcessing: boolean;
    progress: { current: number; total: number } | null;
}

export const BatchPriorityModal: React.FC<BatchPriorityModalProps> = ({
    isOpen,
    onClose,
    selectedCount,
    onConfirmPriority,
    isProcessing,
    progress
}) => {
    const [selectedPriority, setSelectedPriority] = useState<'Normal' | 'Urgência' | 'Especial'>('Normal');
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        try {
            await onConfirmPriority(selectedPriority);
        } catch (err: any) {
            setError(err.message || 'Erro ao alterar prioridade em lote.');
        }
    };

    const progressPercentage = progress && progress.total > 0
        ? Math.round((progress.current / progress.total) * 100)
        : 0;

    return typeof document !== 'undefined' ? createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden border border-amber-200 flex flex-col animate-in zoom-in-95 duration-200">
                <div className="p-4 sm:p-5 border-b border-amber-100 bg-amber-50/80 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-amber-500/20">
                            <Sparkles className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-sm sm:text-base font-black text-amber-950 uppercase tracking-tight">
                                Alterar Prioridade em Lote
                            </h3>
                            <p className="text-[11px] text-amber-800 font-bold uppercase tracking-wider">
                                {selectedCount} solicitação(ões) selecionada(s)
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isProcessing}
                        className="p-1.5 hover:bg-slate-200/80 rounded-xl text-slate-400 hover:text-slate-700 transition-colors cursor-pointer disabled:opacity-40"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    {error && (
                        <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs font-bold flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="block text-xs font-black uppercase tracking-wider text-slate-700">
                            Nova Prioridade para as solicitações:
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                            {(['Normal', 'Urgência', 'Especial'] as const).map(p => {
                                const isSel = selectedPriority === p;
                                return (
                                    <button
                                        key={p}
                                        type="button"
                                        onClick={() => setSelectedPriority(p)}
                                        className={`p-3 rounded-2xl border text-center transition-all cursor-pointer ${
                                            isSel
                                                ? p === 'Especial'
                                                    ? 'bg-amber-100 border-amber-400 text-amber-950 ring-2 ring-amber-400/40 font-black shadow-xs'
                                                    : p === 'Urgência'
                                                    ? 'bg-rose-100 border-rose-400 text-rose-950 ring-2 ring-rose-400/40 font-black shadow-xs'
                                                    : 'bg-emerald-100 border-emerald-400 text-emerald-950 ring-2 ring-emerald-400/40 font-black shadow-xs'
                                                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 font-bold'
                                        }`}
                                    >
                                        <span className="text-xs uppercase tracking-wider block">{p}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {isProcessing && (
                        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-2">
                            <div className="flex justify-between items-center text-xs font-bold text-amber-900">
                                <span className="flex items-center gap-1.5">
                                    <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
                                    Atualizando prioridades...
                                </span>
                                <span>{progress?.current || 0} de {progress?.total || selectedCount} ({progressPercentage}%)</span>
                            </div>
                            <div className="w-full bg-amber-200/70 h-2.5 rounded-full overflow-hidden">
                                <div
                                    className="bg-amber-600 h-full transition-all duration-200 rounded-full"
                                    style={{ width: `${progressPercentage}%` }}
                                />
                            </div>
                        </div>
                    )}

                    <div className="flex items-center justify-end gap-2.5 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isProcessing}
                            className="px-4 py-2 border border-slate-200 hover:bg-slate-100 rounded-xl text-xs font-extrabold text-slate-600 uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-40"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isProcessing}
                            className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-black rounded-xl text-xs uppercase tracking-wider transition-all shadow-md shadow-amber-600/30 flex items-center gap-2 active:scale-95 cursor-pointer disabled:opacity-50"
                        >
                            {isProcessing ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>Salvando...</span>
                                </>
                            ) : (
                                <>
                                    <Sparkles className="w-4 h-4" />
                                    <span>Aplicar Prioridade ({selectedPriority})</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    ) : null;
};

// ==================== MODAL DE PAUSAR / RETOMAR EM LOTE ====================

interface BatchPauseResumeModalProps {
    isOpen: boolean;
    mode: 'pause' | 'resume';
    onClose: () => void;
    selectedCount: number;
    onConfirm: (reason: string) => Promise<void>;
    isProcessing: boolean;
    progress: { current: number; total: number } | null;
}

export const BatchPauseResumeModal: React.FC<BatchPauseResumeModalProps> = ({
    isOpen,
    mode,
    onClose,
    selectedCount,
    onConfirm,
    isProcessing,
    progress
}) => {
    const [reason, setReason] = useState('');
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (mode === 'pause' && (!reason.trim() || reason.trim().length < 3)) {
            setError('Por favor, informe o motivo da pausa em lote.');
            return;
        }
        try {
            await onConfirm(reason.trim());
        } catch (err: any) {
            setError(err.message || 'Erro ao processar ação em lote.');
        }
    };

    const isPause = mode === 'pause';

    return typeof document !== 'undefined' ? createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
            <div className={`bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden border ${isPause ? 'border-amber-300' : 'border-emerald-300'} flex flex-col animate-in zoom-in-95 duration-200`}>
                <div className={`p-4 sm:p-5 border-b ${isPause ? 'border-amber-100 bg-amber-50/80 text-amber-950' : 'border-emerald-100 bg-emerald-50/80 text-emerald-950'} flex items-center justify-between`}>
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-2xl ${isPause ? 'bg-amber-500' : 'bg-emerald-500'} text-white flex items-center justify-center shrink-0 shadow-md`}>
                            {isPause ? <PauseCircle className="w-5 h-5" /> : <PlayCircle className="w-5 h-5" />}
                        </div>
                        <div>
                            <h3 className="text-sm sm:text-base font-black uppercase tracking-tight">
                                {isPause ? 'Pausar Solicitações em Lote' : 'Retomar Solicitações em Lote'}
                            </h3>
                            <p className="text-[11px] font-bold uppercase tracking-wider opacity-80">
                                {selectedCount} solicitação(ões) selecionada(s)
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isProcessing}
                        className="p-1.5 hover:bg-slate-200/80 rounded-xl text-slate-400 hover:text-slate-700 transition-colors cursor-pointer disabled:opacity-40"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    {error && (
                        <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs font-bold flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    {isPause ? (
                        <div className="space-y-1.5">
                            <label className="block text-xs font-black uppercase tracking-wider text-slate-700">
                                Motivo da Pausa <span className="text-rose-500">*</span>
                            </label>
                            <textarea
                                rows={2}
                                required
                                placeholder="Informe o motivo da pausa das solicitações na fila..."
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs font-semibold focus:bg-white focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all text-slate-900 placeholder:text-slate-400"
                            />
                            <p className="text-[10px] text-slate-400">A posição na fila de espera permanecerá preservada.</p>
                        </div>
                    ) : (
                        <p className="text-xs text-slate-600 font-semibold">
                            As solicitações selecionadas que estiverem pausadas serão reintegradas à fila de espera em suas posições originais.
                        </p>
                    )}

                    <div className="flex items-center justify-end gap-2.5 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isProcessing}
                            className="px-4 py-2 border border-slate-200 hover:bg-slate-100 rounded-xl text-xs font-extrabold text-slate-600 uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-40"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isProcessing}
                            className={`px-5 py-2.5 text-white font-black rounded-xl text-xs uppercase tracking-wider transition-all shadow-md flex items-center gap-2 active:scale-95 cursor-pointer disabled:opacity-50 ${
                                isPause ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/30' : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30'
                            }`}
                        >
                            {isProcessing ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>Processando...</span>
                                </>
                            ) : (
                                <span>Confirmar {isPause ? 'Pausa' : 'Retomada'} ({selectedCount})</span>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    ) : null;
};

// ==================== MODAL DE RESUMO DE RESULTADOS ====================

interface BatchResultSummaryModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    result: {
        totalRequested: number;
        successCount: number;
        failureCount: number;
        errors: { id: string; patientName?: string; message: string }[];
    } | null;
}

export const BatchResultSummaryModal: React.FC<BatchResultSummaryModalProps> = ({
    isOpen,
    onClose,
    title,
    result
}) => {
    if (!isOpen || !result) return null;

    const hasErrors = result.failureCount > 0;

    return typeof document !== 'undefined' ? createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 flex flex-col animate-in zoom-in-95 duration-200">
                <div className={`p-5 border-b ${hasErrors ? 'border-amber-100 bg-amber-50/80' : 'border-emerald-100 bg-emerald-50/80'} flex items-center justify-between`}>
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-2xl ${hasErrors ? 'bg-amber-500' : 'bg-emerald-500'} text-white flex items-center justify-center shrink-0 shadow-md`}>
                            {hasErrors ? <AlertTriangle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
                        </div>
                        <div>
                            <h3 className="text-sm sm:text-base font-black text-slate-900 uppercase tracking-tight">
                                {title}
                            </h3>
                            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                Relatório da operação em lote
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 hover:bg-slate-200/80 rounded-xl text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-5 space-y-4">
                    {/* Contadores */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-center">
                            <span className="text-2xl font-black text-emerald-700 block">{result.successCount}</span>
                            <span className="text-[10.5px] font-black uppercase text-emerald-800 tracking-wider">Processados com Sucesso</span>
                        </div>
                        <div className={`p-3 rounded-2xl text-center border ${hasErrors ? 'bg-rose-50 border-rose-200' : 'bg-slate-50 border-slate-200'}`}>
                            <span className={`text-2xl font-black block ${hasErrors ? 'text-rose-700' : 'text-slate-400'}`}>{result.failureCount}</span>
                            <span className={`text-[10.5px] font-black uppercase tracking-wider ${hasErrors ? 'text-rose-800' : 'text-slate-400'}`}>Falhas / Avisos</span>
                        </div>
                    </div>

                    {/* Lista de Falhas se houver */}
                    {hasErrors && (
                        <div className="space-y-1.5">
                            <span className="text-[10.5px] font-black uppercase tracking-wider text-rose-700 block">
                                Detalhes das Não-Conformidades:
                            </span>
                            <div className="max-h-40 overflow-y-auto custom-scrollbar border border-rose-200 bg-rose-50/50 rounded-2xl p-2.5 space-y-1.5 text-xs">
                                {result.errors.map((err, idx) => (
                                    <div key={idx} className="p-1.5 bg-white rounded-xl border border-rose-200 text-rose-900">
                                        {err.patientName && <span className="font-extrabold block">{err.patientName}</span>}
                                        <span className="text-[11px] text-rose-700">{err.message}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="pt-2 flex justify-end">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-xl text-xs uppercase tracking-wider transition-all shadow-md active:scale-95 cursor-pointer"
                        >
                            Concluir
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    ) : null;
};
