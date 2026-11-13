import React from 'react';
import { createPortal } from 'react-dom';
import { 
    X, Undo2, ArrowLeft, ArrowRightLeft, ShieldCheck, 
    AlertTriangle, Loader2, Calendar, Clock, MapPin, Building2, User
} from 'lucide-react';
import { TransferRecord } from '../../services/consultasService';

interface UndoTransferModalProps {
    isOpen: boolean;
    onClose: () => void;
    transferRecord: TransferRecord | null;
    targetBookingId?: string;
    onConfirmUndo: (record: TransferRecord, bookingId?: string) => Promise<void>;
    isReverting: boolean;
}

export const UndoTransferModal: React.FC<UndoTransferModalProps> = ({
    isOpen,
    onClose,
    transferRecord,
    targetBookingId,
    onConfirmUndo,
    isReverting
}) => {
    if (!isOpen || !transferRecord) return null;

    // Se houver um targetBookingId especificado, foca nele; senão, lista todos não revertidos
    const impactedBookings = targetBookingId
        ? transferRecord.bookings.filter(b => b.bookingId === targetBookingId)
        : transferRecord.bookings.filter(b => !b.reverted);

    const sourceProc = transferRecord.sourceProcedimento;
    const targetProc = transferRecord.targetProcedimento;

    const handleConfirm = async () => {
        try {
            await onConfirmUndo(transferRecord, targetBookingId);
        } catch (err) {
            console.error('[UndoTransferModal] Erro ao confirmar reversão:', err);
        }
    };

    return typeof document !== 'undefined' ? createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="p-4 sm:p-5 border-b border-amber-100 bg-gradient-to-r from-amber-50/90 via-orange-50/40 to-white flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-amber-100 border border-amber-300 text-amber-700 flex items-center justify-center shadow-inner">
                            <Undo2 className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-sm sm:text-base font-black text-slate-900 uppercase tracking-tight">
                                    Desfazer Transferência
                                </h3>
                                <span className="px-2.5 py-0.5 rounded-full bg-amber-600 text-white font-black text-[10px] tracking-wider uppercase">
                                    {impactedBookings.length} {impactedBookings.length === 1 ? 'Solicitação' : 'Solicitações'}
                                </span>
                            </div>
                            <p className="text-[11px] text-slate-500 font-semibold mt-0.5">
                                Restaura a solicitação ao procedimento de origem preservando integralmente o agendamento
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isReverting}
                        className="p-1.5 hover:bg-slate-200/80 rounded-xl text-slate-400 hover:text-slate-700 transition-colors cursor-pointer disabled:opacity-40"
                        title="Fechar"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-4 sm:p-6 overflow-y-auto custom-scrollbar flex-1 space-y-4">
                    {/* Comparativo de Procedimentos: De onde está saindo e para onde está voltando */}
                    <div className="bg-slate-50/90 p-4 rounded-2xl border border-slate-200/90">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-2.5">
                            Reversão de Procedimento
                        </span>

                        <div className="grid grid-cols-1 md:grid-cols-11 gap-3 items-center">
                            {/* Procedimento Atual (Destino) */}
                            <div className="md:col-span-5 p-3 rounded-xl bg-white border border-slate-200 shadow-2xs flex flex-col gap-1.5">
                                <span className="text-[9.5px] font-bold uppercase text-slate-400 tracking-wider">
                                    Procedimento Atual (Será Revertido)
                                </span>
                                <div className="flex items-center gap-2 flex-wrap">
                                    {targetProc.code && (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-black text-slate-700 bg-slate-100 border border-slate-300 tabular-nums">
                                            {targetProc.code}
                                        </span>
                                    )}
                                    <span className="text-xs sm:text-[13px] font-black text-slate-800 leading-tight">
                                        {targetProc.name}
                                    </span>
                                </div>
                            </div>

                            {/* Ícone Indicador Central de Reversão */}
                            <div className="md:col-span-1 flex flex-col items-center justify-center my-1 md:my-0">
                                <div className="w-8 h-8 rounded-full bg-amber-100 border border-amber-300 text-amber-700 flex items-center justify-center shadow-xs">
                                    <Undo2 className="w-4 h-4" />
                                </div>
                                <span className="text-[8.5px] font-black uppercase text-amber-800 mt-0.5 hidden md:block">
                                    Volta
                                </span>
                            </div>

                            {/* Procedimento Original (Origem que será Restaurada) */}
                            <div className="md:col-span-5 p-3 rounded-xl bg-blue-50/60 border border-blue-200/90 shadow-2xs flex flex-col gap-1.5">
                                <span className="text-[9.5px] font-black uppercase text-blue-800 tracking-wider flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600 inline-block"></span>
                                    Procedimento Original (A Ser Restaurado)
                                </span>
                                <div className="flex items-center gap-2 flex-wrap">
                                    {sourceProc.code && (
                                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs sm:text-sm font-black text-blue-900 bg-blue-100/70 border border-blue-300/80 tabular-nums shadow-2xs">
                                            {sourceProc.code}
                                        </span>
                                    )}
                                    <span className="text-xs sm:text-[13px] font-black text-blue-950 leading-tight">
                                        {sourceProc.name}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Lista das solicitações impactadas */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                                {impactedBookings.length === 1 ? 'Solicitação Selecionada' : `Solicitações Impactadas (${impactedBookings.length})`}
                            </span>
                            <span className="text-[10.5px] text-slate-400">
                                Transferida por {transferRecord.userName} em {new Date(transferRecord.timestamp).toLocaleString('pt-BR')}
                            </span>
                        </div>

                        <div className="max-h-52 overflow-y-auto custom-scrollbar space-y-2 pr-0.5">
                            {impactedBookings.map((b) => (
                                <div key={b.bookingId} className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs flex flex-col gap-1.5">
                                    <div className="flex items-center justify-between flex-wrap gap-2">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center font-black text-xs">
                                                <User className="w-3.5 h-3.5" />
                                            </div>
                                            <span className="text-xs sm:text-sm font-black text-slate-900">
                                                {b.patientName}
                                            </span>
                                            {b.patientCpf && (
                                                <span className="text-[11px] font-mono text-slate-400">
                                                    CPF: {b.patientCpf}
                                                </span>
                                            )}
                                        </div>

                                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wide border ${
                                            b.status === 'Agendado'
                                                ? 'bg-sky-50 text-sky-800 border-sky-200'
                                                : b.status === 'Realizado'
                                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                                : b.status === 'Fila de espera'
                                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                                : 'bg-slate-50 text-slate-700 border-slate-200'
                                        }`}>
                                            {b.status || 'Solicitado'}
                                        </span>
                                    </div>

                                    {/* Linha de Dados Preservados */}
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1.5 border-t border-slate-100 text-[11px]">
                                        <div className="flex items-center gap-1.5 text-slate-600">
                                            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                            <span>
                                                Data: <strong className="text-slate-800">{b.appointmentDate ? new Date(b.appointmentDate + 'T12:00:00').toLocaleDateString('pt-BR') : 'Aguardando Vaga'}</strong>
                                            </span>
                                        </div>

                                        {b.appointmentTime && (
                                            <div className="flex items-center gap-1.5 text-slate-600">
                                                <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                <span>
                                                    Horário: <strong className="text-slate-800">{b.appointmentTime.substring(0, 5)}</strong>
                                                </span>
                                            </div>
                                        )}

                                        <div className="flex items-center gap-1.5 text-slate-600 truncate">
                                            <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                            <span className="truncate" title={b.prestador || 'Não definido'}>
                                                Local: <strong className="text-slate-800">{b.prestador || '—'}</strong>
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Alerta de Garantia de Preservação */}
                    <div className="p-3.5 rounded-2xl bg-blue-50/80 border border-blue-200 text-blue-950 text-xs flex items-start gap-3">
                        <div className="w-7 h-7 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                            <ShieldCheck className="w-4 h-4" />
                        </div>
                        <div className="space-y-1">
                            <span className="font-black uppercase text-[10.5px] text-blue-900 tracking-wider block">
                                Preservação Integral Garantida:
                            </span>
                            <p className="text-[11.5px] leading-relaxed text-blue-900/90 font-medium">
                                A reversão alterará <strong>exclusivamente o procedimento vinculado</strong>. A data e horário do agendamento, local/prestador, status da solicitação, prioridade, data original da solicitação e documentos do paciente permanecerão <strong>100% inalterados</strong>.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3 shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isReverting}
                        className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 text-xs font-black uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-50"
                    >
                        Cancelar
                    </button>

                    <button
                        type="button"
                        onClick={handleConfirm}
                        disabled={isReverting || impactedBookings.length === 0}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-95 text-white text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-amber-600/25 cursor-pointer disabled:opacity-50"
                    >
                        {isReverting ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Restaurando Procedimento...
                            </>
                        ) : (
                            <>
                                <Undo2 className="w-4 h-4" />
                                Confirmar e Desfazer Transferência
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    ) : null;
};

