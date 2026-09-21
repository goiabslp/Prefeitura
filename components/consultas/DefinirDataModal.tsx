import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ConsultaAgendamento, ConsultaVaga } from '../../types';
import { 
    X, Calendar, Clock, CheckCircle2, AlertCircle, Loader2, 
    Sparkles, User as UserIcon, Activity, Stethoscope, ChevronRight,
    ShieldCheck, Phone, Check, CalendarDays, Sun, Sunset
} from 'lucide-react';
import * as db from '../../services/consultasService';

interface DefinirDataModalProps {
    isOpen: boolean;
    booking: ConsultaAgendamento | null;
    onClose: () => void;
    onSuccess?: () => void;
}

export const DefinirDataModal: React.FC<DefinirDataModalProps> = ({
    isOpen,
    booking,
    onClose,
    onSuccess
}) => {
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    const [vagas, setVagas] = useState<ConsultaVaga[]>([]);
    const [confirmedBookings, setConfirmedBookings] = useState<ConsultaAgendamento[]>([]);
    const [selectedDate, setSelectedDate] = useState<string>('');
    const [selectedSlotId, setSelectedSlotId] = useState<string>('');

    // Carregar vagas livres do procedimento
    useEffect(() => {
        if (!isOpen || !booking) {
            setSelectedDate('');
            setSelectedSlotId('');
            setErrorMsg('');
            setSuccessMsg('');
            setVagas([]);
            setConfirmedBookings([]);
            return;
        }

        const procId = booking.procedimento_id || booking.procedimento?.id;
        if (!procId) {
            setErrorMsg('Procedimento não identificado nesta solicitação.');
            return;
        }

        const fetchProcSlots = async () => {
            setLoading(true);
            setErrorMsg('');
            try {
                const [vagasData, bookingsData] = await Promise.all([
                    db.getVagas(procId),
                    db.getAgendamentos({ procedimentoId: procId })
                ]);
                setVagas(vagasData || []);
                setConfirmedBookings(bookingsData || []);
            } catch (err: any) {
                console.error('[DefinirDataModal] Erro ao carregar vagas:', err);
                setErrorMsg('Erro ao carregar as vagas do procedimento.');
            } finally {
                setLoading(false);
            }
        };

        fetchProcSlots();
    }, [isOpen, booking?.id]);

    // Filtrar apenas vagas físicas efetivamente livres
    const freeSlots = useMemo(() => {
        if (!vagas.length) return [];
        return db.getFreeSlotsForProcedure(vagas, confirmedBookings);
    }, [vagas, confirmedBookings]);

    // Agrupar vagas livres por data (YYYY-MM-DD)
    const datesMap = useMemo(() => {
        const map: Record<string, ConsultaVaga[]> = {};
        freeSlots.forEach(slot => {
            if (!map[slot.data]) {
                map[slot.data] = [];
            }
            map[slot.data].push(slot);
        });

        // Ordenar os horários de cada dia
        Object.keys(map).forEach(d => {
            map[d].sort((a, b) => a.hora.localeCompare(b.hora));
        });

        return map;
    }, [freeSlots]);

    // Lista de datas ordenadas
    const availableDates = useMemo(() => {
        return Object.keys(datesMap).sort((a, b) => a.localeCompare(b));
    }, [datesMap]);

    // Auto-selecionar a primeira data se houver e nenhuma estiver selecionada
    useEffect(() => {
        if (availableDates.length > 0 && (!selectedDate || !datesMap[selectedDate])) {
            setSelectedDate(availableDates[0]);
            setSelectedSlotId('');
        }
    }, [availableDates]);

    // Horários e slots da data selecionada
    const timesForSelectedDate = useMemo(() => {
        if (!selectedDate || !datesMap[selectedDate]) return [];
        return datesMap[selectedDate];
    }, [selectedDate, datesMap]);

    // Auto-selecionar apenas a primeira vaga do dia
    useEffect(() => {
        if (timesForSelectedDate.length > 0) {
            if (!selectedSlotId || !timesForSelectedDate.some(s => s.id === selectedSlotId)) {
                setSelectedSlotId(timesForSelectedDate[0].id);
            }
        } else {
            setSelectedSlotId('');
        }
    }, [timesForSelectedDate]);

    const selectedSlot = useMemo(() => {
        return timesForSelectedDate.find(s => s.id === selectedSlotId) || null;
    }, [timesForSelectedDate, selectedSlotId]);

    const selectedTime = selectedSlot ? selectedSlot.hora : '';

    if (!isOpen || !booking) return null;

    const patientName = booking.paciente?.name || 'Paciente';
    const patientNickname = booking.paciente?.nickname;
    const formattedPatientName = patientNickname ? `${patientName} (${patientNickname})` : patientName;
    const rawCpf = booking.paciente?.cpf || '';
    const formattedCpf = rawCpf.length === 11 ? rawCpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : rawCpf;
    const susNumber = booking.paciente?.sus_number;
    const procName = booking.procedimento?.name || 'Procedimento';
    const procType = booking.procedimento?.type || 'Consulta';

    const handleConfirm = async () => {
        if (!selectedDate) {
            setErrorMsg('Por favor, selecione uma data para o agendamento.');
            return;
        }
        if (!selectedSlot) {
            setErrorMsg('Por favor, selecione uma vaga de horário para o agendamento.');
            return;
        }

        setSubmitting(true);
        setErrorMsg('');
        setSuccessMsg('');

        try {
            await db.confirmarDataAgendamento(booking.id, selectedDate, selectedSlot.hora);
            setSuccessMsg('Agendamento confirmado com sucesso!');

            setTimeout(() => {
                onSuccess?.();
                onClose();
            }, 600);
        } catch (err: any) {
            console.error('[DefinirDataModal] Erro ao confirmar agendamento:', err);
            setErrorMsg(err.message || 'Erro ao confirmar o agendamento. Verifique a disponibilidade da vaga.');
        } finally {
            setSubmitting(false);
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200/80 animate-in zoom-in-95 duration-200">
                
                {/* Header do Modal */}
                <div className="p-5 sm:p-6 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white flex items-center justify-between shrink-0 shadow-sm">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center text-white shadow-inner shrink-0">
                            <CalendarDays className="w-6 h-6" />
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded-full bg-white/20 text-emerald-100 text-[10px] font-black uppercase tracking-wider">
                                    Vaga Disponível
                                </span>
                                {booking.priority === 'Especial' && (
                                    <span className="px-2 py-0.5 rounded-full bg-amber-400 text-amber-950 text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-2xs">
                                        <Sparkles className="w-2.5 h-2.5 fill-current" /> Especial
                                    </span>
                                )}
                            </div>
                            <h2 className="text-base sm:text-lg font-black tracking-tight uppercase leading-tight truncate mt-0.5">
                                Definir Data & Horário
                            </h2>
                            <p className="text-[11px] text-emerald-100/90 font-semibold truncate">
                                Vincule o paciente diretamente a uma das vagas liberadas
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        disabled={submitting}
                        className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-2xl transition-all cursor-pointer shrink-0"
                        title="Fechar"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Conteúdo com Scroll */}
                <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 custom-scrollbar bg-slate-50/40">
                    
                    {/* Bloco de Informações do Paciente & Procedimento */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Paciente */}
                        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-1">
                                <UserIcon className="w-3.5 h-3.5 text-emerald-600" /> Paciente
                            </span>
                            <h4 className="text-xs sm:text-sm font-black text-slate-900 uppercase truncate" title={formattedPatientName}>
                                {formattedPatientName}
                            </h4>
                            <div className="flex items-center gap-2 mt-1 flex-wrap text-[11px] font-bold text-slate-500 font-mono">
                                <span>CPF: {formattedCpf || 'Não informado'}</span>
                                {susNumber && (
                                    <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                                        SUS: {susNumber}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Procedimento */}
                        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-1">
                                <Activity className="w-3.5 h-3.5 text-teal-600" /> Procedimento Solicitado
                            </span>
                            <h4 className="text-xs sm:text-sm font-black text-slate-900 uppercase truncate" title={procName}>
                                {procName}
                            </h4>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-teal-50 text-teal-700 border border-teal-200">
                                    {procType}
                                </span>
                                {booking.procedimento?.code && (
                                    <span className="text-[10px] font-mono font-bold text-slate-400">
                                        Cód: {booking.procedimento.code}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Mensagens de Feedback */}
                    {errorMsg && (
                        <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2.5 animate-in fade-in">
                            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                            <span>{errorMsg}</span>
                        </div>
                    )}

                    {successMsg && (
                        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold flex items-center gap-2.5 animate-in fade-in">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>{successMsg}</span>
                        </div>
                    )}

                    {/* Estado de Carregamento */}
                    {loading ? (
                        <div className="py-12 flex flex-col items-center justify-center text-slate-400 space-y-2">
                            <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
                            <span className="text-xs font-bold uppercase tracking-wider">Buscando vagas disponíveis...</span>
                        </div>
                    ) : freeSlots.length === 0 ? (
                        <div className="py-10 px-4 bg-white rounded-2xl border border-dashed border-slate-300 text-center space-y-2">
                            <AlertCircle className="w-10 h-10 text-amber-500 mx-auto opacity-80" />
                            <h4 className="text-sm font-black text-slate-800 uppercase">
                                Nenhuma Vaga Livre Encontrada
                            </h4>
                            <p className="text-xs text-slate-500 max-w-sm mx-auto font-medium">
                                Todas as vagas liberadas para este procedimento já foram preenchidas por outros pacientes ou pausadas. Libere novas vagas em <strong>/Consultas/LiberarVagas</strong>.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            
                            {/* 1. Seleção de Data */}
                            <div>
                                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 mb-2">
                                    1. Selecione o Dia Disponível ({availableDates.length} {availableDates.length === 1 ? 'data' : 'datas'})
                                </label>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                                    {availableDates.map(dateStr => {
                                        const isSelected = selectedDate === dateStr;
                                        const slotsCount = datesMap[dateStr]?.length || 0;
                                        const dateObj = new Date(dateStr + 'T12:00:00');
                                        const dayFormatted = dateObj.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });

                                        return (
                                            <button
                                                key={dateStr}
                                                type="button"
                                                onClick={() => {
                                                    setSelectedDate(dateStr);
                                                    setSelectedSlotId('');
                                                }}
                                                className={`p-3 rounded-2xl border text-left transition-all duration-200 cursor-pointer relative ${
                                                    isSelected
                                                        ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20 shadow-sm'
                                                        : 'bg-white border-slate-200/90 hover:border-emerald-300 hover:bg-slate-50/70'
                                                }`}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <span className={`text-xs font-black uppercase ${isSelected ? 'text-emerald-950' : 'text-slate-800'}`}>
                                                        {dayFormatted}
                                                    </span>
                                                    {isSelected && (
                                                        <div className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                                                            <Check className="w-2.5 h-2.5" />
                                                        </div>
                                                    )}
                                                </div>
                                                <span className={`text-[10px] font-bold block mt-1 ${isSelected ? 'text-emerald-700 font-extrabold' : 'text-slate-400'}`}>
                                                    {slotsCount} {slotsCount === 1 ? 'vaga livre' : 'vagas livres'}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* 2. Seleção de Horário */}
                            {selectedDate && timesForSelectedDate.length > 0 && (
                                <div className="pt-2 animate-in fade-in duration-150">
                                    <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 mb-2">
                                        2. Selecione o Horário ({timesForSelectedDate.length} {timesForSelectedDate.length === 1 ? 'vaga disponível' : 'vagas disponíveis'} neste dia)
                                    </label>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                                        {timesForSelectedDate.map(slot => {
                                            const isSelected = selectedSlotId === slot.id;
                                            const hourNumber = parseInt(slot.hora.substring(0, 2), 10);
                                            const isMorning = hourNumber < 12;

                                            // Contar índice quando há múltiplas vagas no mesmo horário
                                            const sameTimeSlots = timesForSelectedDate.filter(s => s.hora.substring(0, 5) === slot.hora.substring(0, 5));
                                            const isMultiSlot = sameTimeSlots.length > 1;
                                            const slotIndexForTime = isMultiSlot ? sameTimeSlots.findIndex(s => s.id === slot.id) + 1 : null;

                                            return (
                                                <button
                                                    key={slot.id}
                                                    type="button"
                                                    onClick={() => setSelectedSlotId(slot.id)}
                                                    className={`py-2.5 px-3 rounded-2xl border font-black text-xs transition-all duration-200 flex items-center justify-between gap-1.5 cursor-pointer shadow-2xs ${
                                                        isSelected
                                                            ? 'bg-emerald-600 border-emerald-600 text-white shadow-md shadow-emerald-600/25 scale-[1.02] ring-2 ring-emerald-600/30'
                                                            : 'bg-white border-slate-200 text-slate-800 hover:border-emerald-300 hover:bg-emerald-50/40'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-1.5 font-mono">
                                                        {isMorning ? (
                                                            <Sun className={`w-3.5 h-3.5 ${isSelected ? 'text-amber-200' : 'text-amber-500'}`} />
                                                        ) : (
                                                            <Sunset className={`w-3.5 h-3.5 ${isSelected ? 'text-orange-200' : 'text-orange-500'}`} />
                                                        )}
                                                        <span className="text-xs">{slot.hora.substring(0, 5)}</span>
                                                    </div>
                                                    {isMultiSlot ? (
                                                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-extrabold uppercase tracking-wider ${
                                                            isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                                                        }`}>
                                                            Vaga {slotIndexForTime}
                                                        </span>
                                                    ) : isSelected ? (
                                                        <Check className="w-3.5 h-3.5 text-white" />
                                                    ) : null}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Resumo da Seleção Atual */}
                            {selectedDate && selectedTime && (
                                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-300/80 text-emerald-950 flex items-center justify-between gap-3 animate-in fade-in">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                                            <Calendar className="w-4 h-4" />
                                        </div>
                                        <div className="min-w-0">
                                            <span className="text-[10px] font-black uppercase text-emerald-800 tracking-wider block">
                                                Reserva Selecionada:
                                            </span>
                                            <span className="text-xs font-black uppercase tracking-tight">
                                                {new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR')} às {selectedTime.substring(0, 5)}
                                            </span>
                                        </div>
                                    </div>
                                    <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-lg bg-emerald-600 text-white shrink-0 shadow-2xs">
                                        Pronto para Agendar
                                    </span>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer com Ações */}
                <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200/80 flex items-center justify-end gap-3 shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={submitting}
                        className="px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-extrabold rounded-2xl text-xs uppercase tracking-wider transition-all cursor-pointer"
                    >
                        Cancelar
                    </button>

                    <button
                        type="button"
                        onClick={handleConfirm}
                        disabled={!selectedDate || !selectedTime || submitting || loading || freeSlots.length === 0}
                        className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl text-xs uppercase tracking-wider transition-all flex items-center gap-2 shadow-md shadow-emerald-600/25 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                        {submitting ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Gravando Agendamento...</span>
                            </>
                        ) : (
                            <>
                                <CheckCircle2 className="w-4 h-4" />
                                <span>Confirmar Agendamento</span>
                            </>
                        )}
                    </button>
                </div>

            </div>
        </div>,
        document.body
    );
};
