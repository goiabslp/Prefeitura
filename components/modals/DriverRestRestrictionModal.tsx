import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ShieldAlert, AlertTriangle, Calendar, Clock, MapPin, X, ArrowRight, Check, Coffee, UserX, Info, Car } from 'lucide-react';
import { DriverValidationResult } from '../../services/driverRestRulesService';
import { Person, Vehicle } from '../../types';

interface DriverRestRestrictionModalProps {
    isOpen: boolean;
    onClose: () => void;
    validationResult: DriverValidationResult | null;
    driver?: Person | null;
    vehicle?: Vehicle | null;
}

export const DriverRestRestrictionModal: React.FC<DriverRestRestrictionModalProps> = ({
    isOpen,
    onClose,
    validationResult,
    driver,
    vehicle
}) => {
    const [isClosing, setIsClosing] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setIsClosing(false);
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    if (!isOpen && !isClosing) return null;
    if (!validationResult) return null;

    const handleClose = () => {
        setIsClosing(true);
        setTimeout(() => {
            onClose();
            setIsClosing(false);
        }, 250);
    };

    const getRuleIcon = () => {
        switch (validationResult.code) {
            case 'WEEKEND_REST_VIOLATION':
                return <Coffee className="w-8 h-8 text-amber-500" />;
            case 'HOLIDAY_BLOCK_REST_VIOLATION':
                return <ShieldAlert className="w-8 h-8 text-rose-500" />;
            case 'CONSECUTIVE_DAYS_VIOLATION':
                return <AlertTriangle className="w-8 h-8 text-amber-500" />;
            case 'TIME_OVERLAP_VIOLATION':
                return <Clock className="w-8 h-8 text-rose-500" />;
            default:
                return <UserX className="w-8 h-8 text-rose-500" />;
        }
    };

    const getHeaderBadge = () => {
        switch (validationResult.code) {
            case 'WEEKEND_REST_VIOLATION':
                return { text: 'Regra de Final de Semana', bg: 'bg-amber-100 text-amber-800 border-amber-200' };
            case 'HOLIDAY_BLOCK_REST_VIOLATION':
                return { text: 'Regra de Feriado / Descanso', bg: 'bg-rose-100 text-rose-800 border-rose-200' };
            case 'CONSECUTIVE_DAYS_VIOLATION':
                return { text: 'Limite de Dias Consecutivos', bg: 'bg-amber-100 text-amber-800 border-amber-200' };
            case 'TIME_OVERLAP_VIOLATION':
                return { text: 'Horário Conflitante', bg: 'bg-rose-100 text-rose-800 border-rose-200' };
            default:
                return { text: 'Indisponibilidade do Condutor', bg: 'bg-slate-100 text-slate-800 border-slate-200' };
        }
    };

    const badge = getHeaderBadge();
    const conflictingSchedule = validationResult.conflictingSchedule || validationResult.details?.conflictingSchedule;

    return createPortal(
        <div className={`fixed inset-0 z-[400] flex items-center justify-center p-4 transition-all duration-300 ${isClosing ? 'opacity-0' : 'opacity-100'}`}>
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-md transition-opacity"
                onClick={handleClose}
            />

            {/* Modal Container */}
            <div
                className={`
                    relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100
                    transform transition-all duration-300 ease-out
                    ${isClosing ? 'scale-95 translate-y-4 opacity-0' : 'scale-100 translate-y-0 opacity-100'}
                    animate-in zoom-in-95
                `}
            >
                {/* Header Faixa Visual com Gradiente */}
                <div className="bg-gradient-to-br from-rose-50 via-amber-50/60 to-white px-6 pt-6 pb-5 border-b border-rose-100/60 relative">
                    <button
                        onClick={handleClose}
                        className="absolute top-4 right-4 p-2 bg-white/80 hover:bg-white text-slate-400 hover:text-slate-600 rounded-xl transition-all shadow-xs"
                    >
                        <X className="w-5 h-5" />
                    </button>

                    <div className="flex items-start gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-white shadow-md border border-rose-100 flex items-center justify-center shrink-0">
                            {getRuleIcon()}
                        </div>
                        <div className="flex-1 pr-6">
                            <span className={`inline-block text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full border mb-1.5 ${badge.bg}`}>
                                {badge.text}
                            </span>
                            <h3 className="text-xl font-black text-slate-900 tracking-tight leading-tight">
                                {validationResult.title || 'Motorista Indisponível'}
                            </h3>
                            {driver?.name && (
                                <p className="text-xs font-bold text-slate-500 mt-0.5">
                                    Condutor: <span className="text-slate-800">{driver.name}</span>
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Conteúdo do Modal */}
                <div className="p-6 space-y-4 bg-white max-h-[60vh] overflow-y-auto custom-scrollbar">
                    {/* Mensagem Principal */}
                    <div className="p-4 rounded-2xl bg-rose-50/70 border border-rose-200/70">
                        <p className="text-sm font-semibold text-rose-950 leading-relaxed">
                            {validationResult.message}
                        </p>
                    </div>

                    {/* Detalhe do Agendamento Conflitante / Viagem Existente */}
                    {conflictingSchedule && (
                        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                    <Car className="w-3.5 h-3.5 text-slate-500" /> Viagem Existente Conflitante
                                </span>
                                {conflictingSchedule.protocol && (
                                    <span className="text-[9px] font-mono font-black text-slate-600 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                                        {conflictingSchedule.protocol}
                                    </span>
                                )}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                <div className="space-y-0.5">
                                    <p className="text-[9px] font-bold text-slate-400 uppercase">Destino</p>
                                    <p className="font-bold text-slate-800 truncate" title={conflictingSchedule.destination}>
                                        {conflictingSchedule.destination || 'Não informado'}
                                    </p>
                                </div>
                                <div className="space-y-0.5">
                                    <p className="text-[9px] font-bold text-slate-400 uppercase">Horário de Saída</p>
                                    <p className="font-bold text-slate-800">
                                        {new Date(conflictingSchedule.departureDateTime).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Informação Resumida da Norma */}
                    <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-100 text-slate-600">
                        <Info className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                        <p className="text-xs text-slate-500 leading-snug">
                            As escalas respeitam os limites legais de jornada e descanso: apenas 1 viagem por bloco de final de semana/feriado e máximo de 5 dias consecutivos.
                        </p>
                    </div>
                </div>

                {/* Footer com Botão */}
                <div className="px-6 py-4 bg-slate-50/80 border-t border-slate-100 flex items-center justify-end gap-3">
                    <button
                        onClick={handleClose}
                        className="w-full sm:w-auto px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md active:scale-95 flex items-center justify-center gap-2"
                    >
                        <Check className="w-4 h-4" />
                        <span>Entendido / Selecionar Outro Condutor</span>
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};
