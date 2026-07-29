import React from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, X, AlertTriangle, Fuel, Truck, FileText, Droplets, DollarSign, Clock, ChevronLeft, User } from 'lucide-react';
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
        <div className="fixed inset-0 z-[100] flex items-start sm:items-center justify-center p-4 pt-10 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-md wide:max-w-2xl bg-white rounded-[2rem] shadow-2xl border border-white/20 overflow-hidden flex flex-col animate-scale-in max-h-[90vh]">

                {/* Header */}
                <div className={`${isInvalidOdometer ? 'bg-red-50' : 'bg-slate-50'} p-4 wide:p-6 border-b ${isInvalidOdometer ? 'border-red-100' : 'border-slate-100'} flex items-center justify-between flex-shrink-0`}>
                    <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 wide:w-12 wide:h-12 ${isInvalidOdometer ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'} rounded-xl wide:rounded-2xl flex items-center justify-center shadow-sm`}>
                            <AlertTriangle className="w-4 h-4 wide:w-6 wide:h-6" />
                        </div>
                        <div>
                            <h3 className={`text-base wide:text-xl font-bold ${isInvalidOdometer ? 'text-red-800' : 'text-slate-800'} leading-tight`}>
                                {isInvalidOdometer ? 'Alerta de Bloqueio' : 'Confirmar Registro'}
                            </h3>
                            <p className={`hidden wide:block text-sm ${isInvalidOdometer ? 'text-red-500' : 'text-slate-500'} font-medium`}>
                                {isInvalidOdometer ? 'Valor do Horímetro inválido' : 'Verifique os dados com atenção'}
                            </p>
                            <p className={`wide:hidden text-[9px] ${isInvalidOdometer ? 'text-red-500' : 'text-slate-500'} font-bold uppercase tracking-wider`}>
                                {isInvalidOdometer ? 'Horímetro Inválido' : 'Confira os dados'}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 wide:p-2 hover:bg-slate-200 rounded-full text-slate-400 transition-colors"
                    >
                        <X className="w-5 h-5 wide:w-6 wide:h-6" />
                    </button>
                </div>

                {/* Content - Scrollable */}
                <div className="p-4 wide:p-8 space-y-4 wide:space-y-6 overflow-y-auto custom-scrollbar flex-1">
                    {isInvalidOdometer && (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-3 wide:p-4 flex gap-3 animate-pulse">
                            <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                            <p className="text-[10px] wide:text-xs text-red-700 font-bold leading-relaxed">
                                BLOQUEIO: O novo horímetro não pode ser menor ou igual ao último registro do sistema.
                            </p>
                        </div>
                    )}

                    <div className="grid grid-cols-1 wide:grid-cols-2 gap-4 wide:gap-8">
                        {/* Left Column: Core Data */}
                        <div className="space-y-4 wide:space-y-6">
                            {/* Invoice Number */}
                            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex items-center gap-4 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
                                    <FileText className="w-16 h-16" />
                                </div>
                                <div className="w-10 h-10 wide:w-12 wide:h-12 bg-white rounded-xl flex items-center justify-center text-slate-400 border border-slate-200 shadow-sm z-10">
                                    <FileText className="w-5 h-5 wide:w-6 wide:h-6" />
                                </div>
                                <div className="flex flex-col z-10">
                                    <span className="text-[9px] wide:text-xs uppercase font-bold text-slate-400 tracking-wider">Número da Nota</span>
                                    <span className="text-lg wide:text-xl font-black text-slate-900">{data.invoiceNumber || '---'}</span>
                                </div>
                            </div>

                            {/* Vehicle */}
                            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex items-center gap-4 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
                                    <Truck className="w-16 h-16" />
                                </div>
                                <div className="w-10 h-10 wide:w-12 wide:h-12 bg-cyan-500/10 rounded-xl flex items-center justify-center text-cyan-600 border border-cyan-500/20 shadow-sm z-10">
                                    <Truck className="w-5 h-5 wide:w-6 wide:h-6" />
                                </div>
                                <div className="flex flex-col z-10">
                                    <span className="text-[9px] wide:text-xs uppercase font-bold text-slate-400 tracking-wider">Veículo</span>
                                    <span className="text-lg wide:text-xl font-black text-slate-900 font-mono">{data.vehicle}</span>
                                </div>
                            </div>

                            {/* Driver */}
                            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex items-center gap-4 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
                                    <User className="w-16 h-16" />
                                </div>
                                <div className="w-10 h-10 wide:w-12 wide:h-12 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-600 border border-indigo-500/20 shadow-sm z-10">
                                    <User className="w-5 h-5 wide:w-6 wide:h-6" />
                                </div>
                                <div className="flex flex-col z-10 min-w-0">
                                    <span className="text-[9px] wide:text-xs uppercase font-bold text-slate-400 tracking-wider">Motorista</span>
                                    <span className="text-base wide:text-lg font-black text-slate-900 truncate">{data.driver || '---'}</span>
                                </div>
                            </div>

                            {/* Fuel & Liters */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-slate-50 rounded-2xl p-3 wide:p-4 border border-slate-100 flex flex-col">
                                    <span className="text-[9px] wide:text-xs uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1.5 mb-1">
                                        <Fuel className="w-3.5 h-3.5 text-slate-400" /> Combustível
                                    </span>
                                    <span className="text-sm wide:text-base font-black text-slate-800 uppercase truncate">{data.fuelType.split(' - ')[0]}</span>
                                </div>
                                <div className="bg-slate-50 rounded-2xl p-3 wide:p-4 border border-slate-100 flex flex-col">
                                    <span className="text-[9px] wide:text-xs uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1.5 mb-1">
                                        <Droplets className="w-3.5 h-3.5 text-slate-400" /> Volume
                                    </span>
                                    <span className="text-sm wide:text-base font-black text-slate-800">{data.liters.toLocaleString('pt-BR', { minimumFractionDigits: 3 })} L</span>
                                </div>
                            </div>
                        </div>

                        {/* Right Column: Odometer & Cost */}
                        <div className="space-y-4 wide:space-y-6 flex flex-col justify-between">
                            {/* Odometer Section */}
                            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-[9px] wide:text-xs uppercase font-bold text-slate-400 tracking-wider">Horímetro Anterior</span>
                                    <span className="text-sm font-bold text-slate-600 font-mono">{data.lastOdometer !== null && data.lastOdometer !== undefined ? `${data.lastOdometer.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} KM/H` : '---'}</span>
                                </div>

                                {data.lastOdometer !== null && data.lastOdometer !== undefined && (
                                    <div className="flex items-center justify-between pt-2 border-t border-slate-200/60">
                                        <span className="text-[9px] wide:text-xs uppercase font-bold text-slate-400 tracking-wider">Horímetro Diferença</span>
                                        <span className={`text-xs font-black font-mono px-2 py-0.5 rounded-md ${currentOdometer - data.lastOdometer > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                            {currentOdometer - data.lastOdometer > 0 ? `+${(currentOdometer - data.lastOdometer).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} KM/H` : `${(currentOdometer - data.lastOdometer).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} KM/H`}
                                        </span>
                                    </div>
                                )}

                                <div className="flex items-center justify-between pt-2 border-t border-slate-200/60">
                                    <span className="text-[9px] wide:text-xs uppercase font-bold text-indigo-500 tracking-wider">Horímetro Novo</span>
                                    <span className="text-xl wide:text-2xl font-black text-indigo-600 font-mono">{currentOdometer.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} <span className="text-xs font-normal text-indigo-400">KM/H</span></span>
                                </div>
                            </div>

                            {/* Total Cost */}
                            <div className="bg-emerald-600 text-white rounded-2xl p-4 wide:p-6 flex flex-col wide:flex-row items-center justify-between gap-2 wide:gap-4 shadow-lg shadow-emerald-500/20 relative overflow-hidden group">
                                <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-white via-emerald-400 to-transparent"></div>
                                <div className="relative z-10 flex flex-col items-center wide:items-start">
                                    <span className="text-[9px] wide:text-xs font-black uppercase tracking-[0.2em] text-emerald-100 mb-1">Valor Total</span>
                                    <div className="flex items-center gap-1">
                                        <DollarSign className="w-4 h-4 wide:w-5 wide:h-5 text-emerald-200" />
                                        <span className="text-2xl wide:text-3xl font-black tracking-tight">
                                            {data.cost.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                </div>
                                <div className="hidden wide:flex relative z-10 w-12 h-12 bg-white/20 rounded-xl items-center justify-center border border-white/20">
                                    <CheckCircle2 className="w-6 h-6 text-white" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="p-3.5 px-4 bg-slate-50 border-t border-slate-100 flex items-center gap-3 w-full">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSaving}
                        className="flex items-center justify-center gap-1.5 py-3 px-5 bg-white border border-slate-200 text-slate-700 font-bold uppercase tracking-widest text-[10px] rounded-xl active:bg-slate-50 disabled:opacity-50 transition-all shadow-sm shrink-0"
                    >
                        <ChevronLeft className="w-4 h-4" />
                        <span>Revisar</span>
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={isSaving || !canConfirm}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-3 px-6 ${
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
