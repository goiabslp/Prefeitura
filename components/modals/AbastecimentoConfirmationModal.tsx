import React from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, X, AlertTriangle, Fuel, Truck, FileText, Droplets, DollarSign, ChevronLeft, User } from 'lucide-react';
import { parseFormattedNumber } from '../../utils/numberUtils';

interface AbastecimentoConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    data: {
        invoiceNumber?: string;
        vehicle: string;
        driver?: string;
        fuelType: string;
        liters: number;
        cost: number;
        odometer?: number | string;
        lastOdometer?: number | null;
    } | null;
    isSaving?: boolean;
    isEdit?: boolean;
    isAdmin?: boolean;
}

export const AbastecimentoConfirmationModal: React.FC<AbastecimentoConfirmationModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    data,
    isSaving = false,
    isEdit = false,
    isAdmin = false
}) => {
    if (!isOpen || !data) return null;

    const currentOdometer = typeof data.odometer === 'string'
        ? parseFormattedNumber(data.odometer)
        : data.odometer || 0;

    const isInvalidOdometer = !isEdit && data.lastOdometer !== null && data.lastOdometer !== undefined && currentOdometer <= data.lastOdometer;
    const canConfirm = !isInvalidOdometer || isAdmin;

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-md wide:max-w-2xl bg-white rounded-[1.75rem] wide:rounded-[2rem] shadow-2xl border border-white/20 overflow-hidden flex flex-col animate-scale-in max-h-[95vh]">

                {/* Header */}
                <div className={`${isInvalidOdometer ? 'bg-red-50' : 'bg-slate-50'} p-3 sm:p-4 wide:p-6 border-b ${isInvalidOdometer ? 'border-red-100' : 'border-slate-100'} flex items-center justify-between flex-shrink-0`}>
                    <div className="flex items-center gap-2.5">
                        <div className={`w-7 h-7 sm:w-10 sm:h-10 ${isInvalidOdometer ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'} rounded-lg sm:rounded-xl flex items-center justify-center shadow-xs`}>
                            <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5" />
                        </div>
                        <div>
                            <h3 className={`text-sm sm:text-base wide:text-xl font-bold ${isInvalidOdometer ? 'text-red-800' : 'text-slate-800'} leading-tight`}>
                                {isInvalidOdometer ? 'Alerta de Bloqueio' : 'Confirmar Registro'}
                            </h3>
                            <p className="text-[9px] sm:text-xs text-slate-500 font-bold uppercase tracking-wider">
                                {isInvalidOdometer ? 'Horímetro Inválido' : 'Confira os dados com atenção'}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1 sm:p-2 hover:bg-slate-200 rounded-full text-slate-400 transition-colors"
                    >
                        <X className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                </div>

                {/* Content - Compact Layout without scroll */}
                <div className="p-3 sm:p-5 wide:p-8 space-y-2.5 sm:space-y-4 overflow-y-auto custom-scrollbar flex-1">
                    {isInvalidOdometer && (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-2.5 flex gap-2 animate-pulse">
                            <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                            <p className="text-[10px] text-red-700 font-bold leading-relaxed">
                                BLOQUEIO: O novo horímetro não pode ser menor ou igual ao último registro.
                            </p>
                        </div>
                    )}

                    <div className="space-y-2.5 sm:space-y-4">
                        {/* Row 1: Invoice Number & Vehicle Side by Side */}
                        <div className="grid grid-cols-2 gap-2.5">
                            {/* Invoice Number */}
                            <div className="bg-slate-50 rounded-xl sm:rounded-2xl p-2.5 sm:p-3 border border-slate-100 flex items-center gap-2.5 relative overflow-hidden group">
                                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white rounded-lg sm:rounded-xl flex items-center justify-center text-slate-400 border border-slate-200 shadow-2xs shrink-0">
                                    <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
                                </div>
                                <div className="flex flex-col min-w-0">
                                    <span className="text-[8px] sm:text-[9px] uppercase font-bold text-slate-400 tracking-wider truncate">Nº da Nota</span>
                                    <span className="text-sm sm:text-base font-black text-slate-900 truncate">{data.invoiceNumber || '---'}</span>
                                </div>
                            </div>

                            {/* Vehicle */}
                            <div className="bg-slate-50 rounded-xl sm:rounded-2xl p-2.5 sm:p-3 border border-slate-100 flex items-center gap-2.5 relative overflow-hidden group">
                                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-cyan-500/10 rounded-lg sm:rounded-xl flex items-center justify-center text-cyan-600 border border-cyan-500/20 shadow-2xs shrink-0">
                                    <Truck className="w-4 h-4 sm:w-5 sm:h-5" />
                                </div>
                                <div className="flex flex-col min-w-0">
                                    <span className="text-[8px] sm:text-[9px] uppercase font-bold text-slate-400 tracking-wider truncate">Veículo</span>
                                    <span className="text-sm sm:text-base font-black text-slate-900 font-mono truncate">{data.vehicle}</span>
                                </div>
                            </div>
                        </div>

                        {/* Driver */}
                        <div className="bg-slate-50 rounded-xl sm:rounded-2xl p-2.5 sm:p-3 border border-slate-100 flex items-center gap-2.5 relative overflow-hidden group">
                            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-indigo-500/10 rounded-lg sm:rounded-xl flex items-center justify-center text-indigo-600 border border-indigo-500/20 shadow-2xs shrink-0">
                                <User className="w-4 h-4 sm:w-5 sm:h-5" />
                            </div>
                            <div className="flex flex-col min-w-0 flex-1">
                                <span className="text-[8px] sm:text-[9px] uppercase font-bold text-slate-400 tracking-wider">Motorista</span>
                                <span className="text-xs sm:text-sm font-black text-slate-900 truncate">{data.driver || '---'}</span>
                            </div>
                        </div>

                        {/* Fuel & Volume */}
                        <div className="grid grid-cols-2 gap-2.5">
                            <div className="bg-slate-50 rounded-xl sm:rounded-2xl p-2.5 sm:p-3 border border-slate-100 flex flex-col">
                                <span className="text-[8px] sm:text-[9px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1 mb-0.5">
                                    <Fuel className="w-3 h-3 text-slate-400" /> Combustível
                                </span>
                                <span className="text-xs sm:text-sm font-black text-slate-800 uppercase truncate">{data.fuelType.split(' - ')[0]}</span>
                            </div>
                            <div className="bg-slate-50 rounded-xl sm:rounded-2xl p-2.5 sm:p-3 border border-slate-100 flex flex-col">
                                <span className="text-[8px] sm:text-[9px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1 mb-0.5">
                                    <Droplets className="w-3 h-3 text-slate-400" /> Volume
                                </span>
                                <span className="text-xs sm:text-sm font-black text-slate-800">{data.liters.toLocaleString('pt-BR', { minimumFractionDigits: 3 })} L</span>
                            </div>
                        </div>

                        {/* Odometer Section */}
                        <div className="bg-slate-50 rounded-xl sm:rounded-2xl p-2.5 sm:p-3 border border-slate-100 space-y-1.5 sm:space-y-2">
                            <div className="flex items-center justify-between text-[9px] sm:text-xs">
                                <span className="uppercase font-bold text-slate-400 tracking-wider">Horímetro Anterior</span>
                                <span className="font-bold text-slate-600 font-mono">{data.lastOdometer !== null && data.lastOdometer !== undefined ? `${data.lastOdometer.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} KM/H` : '---'}</span>
                            </div>

                            {data.lastOdometer !== null && data.lastOdometer !== undefined && (
                                <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 text-[9px] sm:text-xs">
                                    <span className="uppercase font-bold text-slate-400 tracking-wider">Horímetro Diferença</span>
                                    <span className={`font-black font-mono px-1.5 py-0.5 rounded ${currentOdometer - data.lastOdometer > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                        {currentOdometer - data.lastOdometer > 0 ? `+${(currentOdometer - data.lastOdometer).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} KM/H` : `${(currentOdometer - data.lastOdometer).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} KM/H`}
                                    </span>
                                </div>
                            )}

                            <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
                                <span className="text-[9px] sm:text-xs uppercase font-bold text-indigo-500 tracking-wider">Horímetro Novo</span>
                                <span className="text-base sm:text-lg wide:text-2xl font-black text-indigo-600 font-mono">{currentOdometer.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} <span className="text-[10px] font-normal text-indigo-400">KM/H</span></span>
                            </div>
                        </div>

                        {/* Total Cost */}
                        <div className="bg-emerald-600 text-white rounded-xl sm:rounded-2xl p-2.5 px-3.5 sm:p-4 flex items-center justify-between shadow-md shadow-emerald-500/15 relative overflow-hidden">
                            <div className="relative z-10 flex flex-col">
                                <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-[0.15em] text-emerald-100 leading-tight">Valor Total</span>
                                <div className="flex items-center gap-1 mt-0.5">
                                    <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-200" />
                                    <span className="text-xl sm:text-2xl font-black tracking-tight">
                                        {data.cost.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                </div>
                            </div>
                            <div className="relative z-10 w-9 h-9 sm:w-10 sm:h-10 bg-white/20 rounded-lg sm:rounded-xl flex items-center justify-center border border-white/20 shrink-0">
                                <CheckCircle2 className="w-5 h-5 text-white" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="p-3 px-4 bg-slate-50 border-t border-slate-100 flex items-center gap-2.5 w-full shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSaving}
                        className="flex items-center justify-center gap-1.5 py-2.5 px-4 bg-white border border-slate-200 text-slate-700 font-bold uppercase tracking-widest text-[10px] rounded-xl active:bg-slate-50 disabled:opacity-50 transition-all shadow-2xs shrink-0"
                    >
                        <ChevronLeft className="w-4 h-4" />
                        <span>Revisar</span>
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={isSaving || !canConfirm}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-5 ${
                            !canConfirm 
                                ? 'bg-slate-200 text-slate-400 cursor-not-allowed' 
                                : isInvalidOdometer && isAdmin 
                                ? 'bg-amber-600 text-white shadow-md shadow-amber-600/20 active:bg-amber-700' 
                                : 'bg-slate-900 text-white shadow-md shadow-slate-950/15 active:bg-slate-800'
                        } font-bold uppercase tracking-widest text-[10px] rounded-xl disabled:opacity-30 disabled:cursor-not-allowed transition-all`}
                    >
                        {isSaving ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                <span>Processando...</span>
                            </>
                        ) : (
                            <>
                                <CheckCircle2 className="w-4 h-4" />
                                <span>{isInvalidOdometer && isAdmin ? 'Sobrescrever' : isInvalidOdometer ? 'Bloqueado' : 'Confirmar'}</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};
