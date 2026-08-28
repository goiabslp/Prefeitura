import React, { useState, useEffect, useRef } from 'react';
import { X, Calendar as CalendarIcon, Save, Trash2, Loader2, Users, CheckSquare, Square, ChevronDown, Lock, Flag, Gift, Search, Repeat } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../services/supabaseClient';
import { calendarService, CalendarEventInvite, CalendarEvent } from '../../services/calendarService';
import { googleCalendarService } from '../../services/googleCalendarService';
import { getPersons } from '../../services/entityService';
import { getLocalISOData } from '../../utils/dateUtils';
import { Person } from '../../types';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSaved: () => void;
    eventToEdit: CalendarEvent | null;
    selectedDate: string; // YYYY-MM-DD
    currentUserId: string;
}

interface UserProfile {
    id: string;
    name: string;
}

export const EventModal: React.FC<Props> = ({
    isOpen, onClose, onSaved, eventToEdit, selectedDate, currentUserId
}) => {
    const [title, setTitle] = useState('');
    const [type, setType] = useState('Pessoal');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [isAllDay, setIsAllDay] = useState(true);
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [description, setDescription] = useState('');
    const [isRecurring, setIsRecurring] = useState(false);
    const [loading, setLoading] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
    const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Invites State
    const [activeTab, setActiveTab] = useState<'details' | 'invites'>('details');
    const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
    const [persons, setPersons] = useState<Person[]>([]);
    const [professionalId, setProfessionalId] = useState('');
    const [personSearch, setPersonSearch] = useState('');
    const [showPersonDropdown, setShowPersonDropdown] = useState(false);
    const [selectedInvites, setSelectedInvites] = useState<{ user_id: string; role: 'Colaborador' | 'Participante' }[]>([]);

    useEffect(() => {
        if (isOpen) {
            fetchUsers();
            if (eventToEdit) {
                setTitle(eventToEdit.title);
                setType(eventToEdit.type);
                setStartDate(eventToEdit.start_date);
                setEndDate(eventToEdit.end_date);
                setIsAllDay(eventToEdit.is_all_day);
                setEndTime(eventToEdit.end_time || '');
                setDescription(eventToEdit.description || '');
                setIsRecurring(eventToEdit.is_recurring || false);
                setProfessionalId(eventToEdit.professional_id || '');

                // Pre-fill invites
                if (eventToEdit.invites) {
                    setSelectedInvites(
                        eventToEdit.invites.map(inv => ({ user_id: inv.user_id, role: inv.role }))
                    );
                } else {
                    setSelectedInvites([]);
                }
                setActiveTab('details');
            } else {
                setTitle('');
                setType('Pessoal');
                const defaultDate = getLocalISOData(new Date()).date;
                setStartDate(selectedDate || defaultDate);
                setEndDate(selectedDate || defaultDate);
                setIsAllDay(true);
                setStartTime('');
                setEndTime('');
                setDescription('');
                setIsRecurring(false);
                setProfessionalId('');
                setSelectedInvites([]);
                setActiveTab('details');
            }
            fetchPersons();
        }
    }, [isOpen, eventToEdit, selectedDate]);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsTypeDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const fetchUsers = async () => {
        const { data } = await supabase.from('profiles').select('id, name').order('name');
        if (data) {
            setAllUsers(data.filter(u => u.id !== currentUserId)); // exclude self
        }
    };

    const fetchPersons = async () => {
        const data = await getPersons();
        setPersons(data);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMessage(null);
        if (!title.trim() || !startDate || !endDate) return;

        if (startDate > endDate) {
            setErrorMessage('A data de término não pode ser anterior à data de início.');
            return;
        }

        if (!isAllDay) {
            if (!startTime || !endTime) {
                setErrorMessage('Informe os horários de início e término.');
                return;
            }
            if (startDate === endDate && startTime >= endTime) {
                setErrorMessage('O horário de término deve ser posterior ao horário de início.');
                return;
            }
        }

        setLoading(true);
        try {
            const payload: Partial<CalendarEvent> = {
                title,
                type,
                start_date: startDate,
                end_date: endDate,
                is_all_day: isAllDay,
                start_time: isAllDay ? undefined : startTime,
                end_time: isAllDay ? undefined : endTime,
                description,
                created_by: currentUserId,
                professional_id: professionalId || undefined,
                is_recurring: (type === 'Aniversário' || type === 'Feriado Municipal') ? true : isRecurring
            };

            const invitesPayload: Partial<CalendarEventInvite>[] = selectedInvites.map(inv => ({
                user_id: inv.user_id,
                role: inv.role,
                status: 'Pendente'
            }));

            if (eventToEdit) {
                // Update Basic Event
                await calendarService.updateEvent(eventToEdit.id, payload);
                if (eventToEdit.google_event_id) {
                    await googleCalendarService.updateGoogleEvent(eventToEdit.google_event_id, { ...eventToEdit, ...payload } as CalendarEvent);
                } else {
                    await googleCalendarService.syncEventToGoogle({ id: eventToEdit.id, ...payload } as CalendarEvent);
                }
                onSaved();
            } else {
                // Create new event with Invites
                const result = await calendarService.createEventWithInvites(payload, invitesPayload);
                if (!result.success) throw new Error(result.error);
                if (result.id) {
                    await googleCalendarService.syncEventToGoogle({ id: result.id, ...payload } as CalendarEvent);
                }
                onSaved();
            }
        } catch (err) {
            console.error('Error saving event:', err);
            setErrorMessage('Erro ao salvar o evento.');
        } finally {
            setLoading(false);
        }
    };

    const confirmDelete = async () => {
        if (!eventToEdit) return;
        setIsConfirmDeleteOpen(false);
        setDeleting(true);
        try {
            if (eventToEdit.google_event_id) {
                await googleCalendarService.deleteGoogleEvent(eventToEdit.google_event_id);
            }
            const success = await calendarService.deleteEvent(eventToEdit.id);
            if (!success) throw new Error('Delete failed');
            onSaved();
        } catch (err) {
            console.error('Error deleting event:', err);
            setErrorMessage('Erro ao excluir o evento.');
        } finally {
            setDeleting(false);
        }
    };

    const toggleInvite = (userId: string) => {
        setSelectedInvites(prev => {
            const exists = prev.find(p => p.user_id === userId);
            if (exists) return prev.filter(p => p.user_id !== userId);
            return [...prev, { user_id: userId, role: 'Participante' }];
        });
    };

    const setRole = (userId: string, role: 'Colaborador' | 'Participante') => {
        setSelectedInvites(prev => prev.map(p => p.user_id === userId ? { ...p, role } : p));
    };

    const selectAll = () => {
        if (selectedInvites.length === allUsers.length) {
            setSelectedInvites([]); // Deselect all
        } else {
            setSelectedInvites(allUsers.map(u => ({ user_id: u.id, role: 'Participante' })));
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[2500] flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                    onClick={onClose}
                />

                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="w-full max-w-lg bg-white rounded-[2rem] shadow-2xl relative z-10 flex flex-col max-h-[90vh]"
                >
                    {/* Header */}
                    <div className="h-28 bg-gradient-to-br from-rose-500 to-pink-600 p-6 flex items-start justify-between shrink-0 relative overflow-hidden rounded-t-[2rem]">
                        <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
                        <div className="absolute -left-10 -bottom-10 w-32 h-32 bg-black/10 rounded-full blur-xl" />

                        <div className="relative z-10 flex-1">
                            <div className="flex items-center gap-3 text-white mb-1">
                                <CalendarIcon className="w-6 h-6 opacity-80" />
                                <h2 className="text-xl font-black tracking-tight">
                                    {eventToEdit ? 'Editar Registro' : 'Novo Registro'}
                                </h2>
                            </div>

                            {/* Tabs */}
                            <div className="flex items-center gap-2 mt-4 bg-white/10 p-1 rounded-xl w-fit">
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('details')}
                                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${activeTab === 'details' ? 'bg-white text-rose-600 shadow' : 'text-white/80 hover:text-white'}`}
                                >
                                    Detalhes
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('invites')}
                                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${activeTab === 'invites' ? 'bg-white text-rose-600 shadow' : 'text-white/80 hover:text-white'}`}
                                >
                                    Convidados
                                    {selectedInvites.length > 0 && (
                                        <span className="w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] flex items-center justify-center font-black">
                                            {selectedInvites.length}
                                        </span>
                                    )}
                                </button>
                            </div>
                        </div>

                        <button
                            onClick={onClose}
                            className="w-8 h-8 rounded-full bg-black/20 hover:bg-black/40 flex items-center justify-center text-white transition-colors relative z-10 shrink-0"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Banner de Erro Customizado */}
                    {errorMessage && (
                        <div className="mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-bold flex items-center justify-between animate-fade-in">
                            <span>{errorMessage}</span>
                            <button onClick={() => setErrorMessage(null)} className="text-rose-500 hover:text-rose-700 font-black">✕</button>
                        </div>
                    )}

                    {/* Form / Content */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                        {activeTab === 'details' ? (
                            <form id="event-form" onSubmit={handleSave} className="flex flex-col gap-5">
                                <div>
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1 block">
                                        Título do Registro
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={title}
                                        onChange={e => setTitle(e.target.value)}
                                        placeholder="Ex: Reunião de Alinhamento"
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all text-slate-700 font-medium placeholder:text-slate-400 outline-none"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1 block">
                                            Data de Início
                                        </label>
                                        <input
                                            type="date"
                                            required
                                            value={startDate}
                                            onChange={e => setStartDate(e.target.value)}
                                            className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all text-slate-700 font-medium outline-none"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1 block">
                                            Data de Término
                                        </label>
                                        <input
                                            type="date"
                                            required
                                            value={endDate}
                                            onChange={e => setEndDate(e.target.value)}
                                            className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all text-slate-700 font-medium outline-none"
                                        />
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <input type="checkbox" id="isAllDay" checked={isAllDay} onChange={e => setIsAllDay(e.target.checked)} className="w-5 h-5 text-rose-600 rounded border-slate-300 focus:ring-rose-500 cursor-pointer" />
                                    <label htmlFor="isAllDay" className="text-sm font-medium text-slate-700 cursor-pointer">Evento de Dia Inteiro</label>
                                </div>

                                {!isAllDay && (
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1 block">Hora Inicial</label>
                                            <input type="time" required={!isAllDay} value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all text-slate-700 font-medium outline-none" />
                                        </div>
                                        <div>
                                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1 block">Hora Final</label>
                                            <input type="time" required={!isAllDay} value={endTime} onChange={e => setEndTime(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all text-slate-700 font-medium outline-none" />
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1 block">
                                        Tipo
                                    </label>
                                    <div className="relative" ref={dropdownRef}>
                                        <button
                                            type="button"
                                            onClick={() => setIsTypeDropdownOpen(!isTypeDropdownOpen)}
                                            className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white focus:bg-white focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all text-slate-700 font-medium flex items-center justify-between outline-none"
                                        >
                                            <span className="flex items-center gap-2">
                                                {type === 'Pessoal' && <Lock className="w-4 h-4 text-amber-500" />}
                                                {type === 'Evento' && <CalendarIcon className="w-4 h-4 text-emerald-500" />}
                                                {type === 'Reunião' && <Users className="w-4 h-4 text-indigo-500" />}
                                                {type === 'Feriado' && <Flag className="w-4 h-4 text-rose-500" />}
                                                {type === 'Feriado Municipal' && <Flag className="w-4 h-4 text-red-500" />}
                                                {type === 'Aniversário' && <Gift className="w-4 h-4 text-pink-500" />}
                                                {type === 'Pessoal' ? 'Evento Pessoal' : type === 'Evento' ? 'Evento Público' : type === 'Reunião' ? 'Reunião Interna' : type === 'Aniversário' ? 'Aniversário' : type === 'Feriado Municipal' ? 'Feriado Municipal' : 'Feriado / Recesso'}
                                            </span>
                                            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${isTypeDropdownOpen ? 'rotate-180' : ''}`} />
                                        </button>

                                        <AnimatePresence>
                                            {isTypeDropdownOpen && (
                                                <motion.div
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, y: 10 }}
                                                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                                                    className="absolute z-[3000] bottom-full left-0 right-0 mb-2 bg-white rounded-2xl shadow-[0_-10px_40px_-10px_rgba(0,0,0,0.15)] border border-slate-100 overflow-hidden"
                                                >
                                                    {[
                                                        { value: 'Pessoal', label: 'Evento Pessoal', icon: Lock, color: 'text-amber-500', bg: 'hover:bg-amber-50' },
                                                        { value: 'Evento', label: 'Evento Público', icon: CalendarIcon, color: 'text-emerald-500', bg: 'hover:bg-emerald-50' },
                                                        { value: 'Reunião', label: 'Reunião Interna', icon: Users, color: 'text-indigo-500', bg: 'hover:bg-indigo-50' },
                                                        { value: 'Aniversário', label: 'Aniversário', icon: Gift, color: 'text-pink-500', bg: 'hover:bg-pink-50' },
                                                        { value: 'Feriado Municipal', label: 'Feriado Municipal', icon: Flag, color: 'text-red-500', bg: 'hover:bg-red-50' },
                                                        { value: 'Feriado', label: 'Feriado / Recesso', icon: Flag, color: 'text-rose-500', bg: 'hover:bg-rose-50' }
                                                    ].map(option => (
                                                        <button
                                                            key={option.value}
                                                            type="button"
                                                            onClick={() => {
                                                                setType(option.value);
                                                                setIsTypeDropdownOpen(false);
                                                            }}
                                                            className={`w-full flex items-center gap-3 px-4 py-3.5 text-sm font-bold transition-colors ${type === option.value ? 'bg-slate-50 text-slate-900 border-l-2 border-slate-300' : `text-slate-600 ${option.bg} border-l-2 border-transparent hover:text-slate-900 hover:border-${option.color.split('-')[1]}-300`}`}
                                                        >
                                                            <option.icon className={`w-4 h-4 ${option.color}`} />
                                                            {option.label}
                                                        </button>
                                                    ))}
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                </div>

                                {type === 'Aniversário' && (
                                    <div className="animate-in slide-in-from-top-2 duration-300">
                                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1 block">
                                            Vincular Profissional
                                        </label>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                value={personSearch}
                                                onChange={e => {
                                                    setPersonSearch(e.target.value);
                                                    setShowPersonDropdown(true);
                                                }}
                                                onFocus={() => setShowPersonDropdown(true)}
                                                placeholder="Buscar profissional..."
                                                className="w-full px-4 py-3 pl-11 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white transition-all text-slate-700 font-medium outline-none"
                                            />
                                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                            {professionalId && !personSearch && (
                                                <div className="absolute left-11 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                    <span className="text-sm font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg">
                                                        {persons.find(p => p.id === professionalId)?.name}
                                                    </span>
                                                </div>
                                            )}

                                            <AnimatePresence>
                                                {showPersonDropdown && (
                                                    <motion.div
                                                        initial={{ opacity: 0, y: 5 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        exit={{ opacity: 0, y: 5 }}
                                                        className="absolute z-[3100] top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-slate-100 max-h-48 overflow-y-auto"
                                                    >
                                                        {persons.filter(p => p.name.toLowerCase().includes(personSearch.toLowerCase())).map(p => (
                                                            <button
                                                                key={p.id}
                                                                type="button"
                                                                onClick={() => {
                                                                    setProfessionalId(p.id);
                                                                    setPersonSearch('');
                                                                    setShowPersonDropdown(false);
                                                                    if (!title) setTitle(`Aniversário: ${p.name}`);
                                                                    if (p.birth_date) {
                                                                        const birth = new Date(p.birth_date);
                                                                        const currentYear = new Date(startDate || selectedDate).getFullYear();
                                                                        const calculatedDate = `${currentYear}-${String(birth.getUTCMonth() + 1).padStart(2, '0')}-${String(birth.getUTCDate()).padStart(2, '0')}`;
                                                                        setStartDate(calculatedDate);
                                                                        setEndDate(calculatedDate);
                                                                    }
                                                                }}
                                                                className="w-full text-left px-4 py-3 hover:bg-slate-50 text-sm font-bold text-slate-700 transition-colors border-b border-slate-50 last:border-0"
                                                            >
                                                                {p.name}
                                                                {p.birth_date && <span className="text-[10px] text-slate-400 ml-2 font-mono">({new Date(p.birth_date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })})</span>}
                                                            </button>
                                                        ))}
                                                        {persons.filter(p => p.name.toLowerCase().includes(personSearch.toLowerCase())).length === 0 && (
                                                            <div className="p-4 text-center text-xs text-slate-400 italic">Nenhum profissional encontrado</div>
                                                        )}
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    </div>
                                )}

                                {/* Recurring Toggle - show for other types but force for requested types */}
                                {(type !== 'Aniversário' && type !== 'Feriado Municipal') && (
                                    <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100 mb-4">
                                        <input
                                            type="checkbox"
                                            id="isRecurring"
                                            checked={isRecurring}
                                            onChange={e => setIsRecurring(e.target.checked)}
                                            className="w-5 h-5 text-rose-600 rounded border-slate-300 focus:ring-rose-500 cursor-pointer"
                                        />
                                        <div className="flex-1">
                                            <label htmlFor="isRecurring" className="text-sm font-bold text-slate-700 cursor-pointer flex items-center gap-2">
                                                <Repeat className="w-4 h-4 text-slate-400" />
                                                Repetir Anualmente
                                            </label>
                                            <p className="text-[10px] text-slate-500">Este evento aparecerá todos os anos na mesma data.</p>
                                        </div>
                                    </div>
                                )}
                                {(type === 'Aniversário' || type === 'Feriado Municipal') && (
                                    <div className="flex items-center gap-2 p-3 bg-rose-50/50 rounded-xl border border-rose-100/50 mb-4">
                                        <Repeat className="w-5 h-5 text-rose-500 opacity-60" />
                                        <div className="flex-1">
                                            <p className="text-sm font-bold text-rose-700">Recorrência Automática Ativada</p>
                                            <p className="text-[10px] text-rose-500">Eventos de {type} são repetidos anualmente de forma automática.</p>
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1 block">
                                        Descrição (Opcional)
                                    </label>
                                    <textarea
                                        value={description}
                                        onChange={e => setDescription(e.target.value)}
                                        placeholder="Detalhes adicionais..."
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all text-slate-700 font-medium placeholder:text-slate-400 outline-none resize-none h-24"
                                    />
                                </div>
                            </form>
                        ) : (
                            <div className="flex flex-col h-full gap-4">
                                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                                    <div>
                                        <h3 className="font-bold text-slate-800">Convidados</h3>
                                        <p className="text-xs text-slate-500">Selecione quem irá participar</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={selectAll}
                                        className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-colors"
                                    >
                                        {selectedInvites.length === allUsers.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
                                    </button>
                                </div>

                                <div className="flex-1 flex flex-col gap-2 overflow-y-auto">
                                    {allUsers.map(user => {
                                        const invite = selectedInvites.find(i => i.user_id === user.id);
                                        const isSelected = !!invite;

                                        return (
                                            <div key={user.id} className={`flex items-center justify-between p-3 border rounded-xl transition-all ${isSelected ? 'border-indigo-200 bg-indigo-50/50' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                                                <div className="flex items-center gap-3 cursor-pointer flex-1" onClick={() => toggleInvite(user.id)}>
                                                    <div className={`text-indigo-600 transition-transform ${isSelected ? 'scale-110' : 'scale-100 text-slate-300'}`}>
                                                        {isSelected ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                                                    </div>
                                                    <span className={`text-sm font-bold ${isSelected ? 'text-indigo-900' : 'text-slate-700'}`}>
                                                        {user.name}
                                                    </span>
                                                </div>

                                                {isSelected && (
                                                    <select
                                                        value={invite.role}
                                                        onChange={(e) => setRole(user.id, e.target.value as 'Colaborador' | 'Participante')}
                                                        className="text-xs font-bold bg-white border border-indigo-200 text-indigo-700 rounded-lg px-2 py-1 outline-none"
                                                    >
                                                        <option value="Participante">Participante</option>
                                                        <option value="Colaborador">Organizador</option>
                                                    </select>
                                                )}
                                            </div>
                                        )
                                    })}
                                    {allUsers.length === 0 && (
                                        <p className="text-center text-slate-500 text-sm py-4">Nenhum outro usuário disponível para convidar.</p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="p-4 border-t border-slate-100 bg-slate-50 rounded-b-[2rem] flex items-center justify-between shrink-0">
                        {eventToEdit ? (
                            <button
                                type="button"
                                onClick={() => setIsConfirmDeleteOpen(true)}
                                disabled={deleting || loading}
                                className="flex items-center gap-2 px-4 py-3 text-rose-500 hover:bg-rose-100 rounded-xl font-bold uppercase tracking-widest text-xs transition-colors cursor-pointer"
                            >
                                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                Excluir
                            </button>
                        ) : <div />}

                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-6 py-3 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl font-bold uppercase tracking-widest text-xs transition-colors cursor-pointer"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={(e) => handleSave(e)}
                                disabled={loading || deleting}
                                className="flex items-center gap-2 px-6 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-lg shadow-rose-500/30 hover:shadow-rose-600/40 font-bold uppercase tracking-widest text-xs transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                            >
                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                Salvar
                            </button>
                        </div>
                    </div>
                </motion.div>

                {/* Modal de Confirmação Customizado (Substituindo confirm()) */}
                {isConfirmDeleteOpen && (
                    <div className="fixed inset-0 z-[2600] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in">
                        <div className="bg-white rounded-[2rem] p-6 max-w-sm w-full space-y-4 shadow-2xl border border-slate-100 text-center">
                            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
                                <Trash2 className="w-6 h-6" />
                            </div>
                            <h3 className="text-base font-extrabold text-slate-800">Excluir Evento?</h3>
                            <p className="text-xs text-slate-500">
                                Tem certeza que deseja remover este compromisso? Esta ação não poderá ser desfeita.
                            </p>
                            <div className="flex items-center gap-3 pt-2">
                                <button
                                    onClick={() => setIsConfirmDeleteOpen(false)}
                                    className="flex-1 py-3 text-slate-500 hover:text-slate-700 font-bold text-xs uppercase tracking-wider rounded-xl hover:bg-slate-100 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={confirmDelete}
                                    className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-rose-500/20 active:scale-95 transition-all"
                                >
                                    Confirmar
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </AnimatePresence >
    );
};
