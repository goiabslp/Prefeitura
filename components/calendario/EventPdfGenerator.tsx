import React from 'react';
import { createPortal } from 'react-dom';
import { CalendarEvent } from '../../services/calendarService';
import { AppState } from '../../types';
import { PageWrapper } from '../PageWrapper';
import { Calendar as CalendarIcon, Clock, AlignLeft, Users, Star, User, Flag, Lock } from 'lucide-react';

interface EventPdfGeneratorProps {
    event: CalendarEvent;
    state?: AppState;
    appState?: AppState;
}

export const EventPdfGenerator: React.FC<EventPdfGeneratorProps> = ({ event, state, appState }) => {
    const finalState = appState || state;
    // Cores e Ícones do Evento
    const colors: Record<string, any> = {
        Notícia: { text: 'text-sky-700', border: 'border-sky-200', icon: 'text-sky-500', iconComp: CalendarIcon },
        Feriado: { text: 'text-red-700', border: 'border-red-200', icon: 'text-red-500', iconComp: Flag },
        Reunião: { text: 'text-indigo-700', border: 'border-indigo-200', icon: 'text-indigo-500', iconComp: Users },
        Evento: { text: 'text-emerald-700', border: 'border-emerald-200', icon: 'text-emerald-500', iconComp: CalendarIcon },
        Pessoal: { text: 'text-amber-700', border: 'border-amber-200', icon: 'text-amber-500', iconComp: Lock }
    };
    const theme = colors[event.type] || { text: 'text-slate-700', border: 'border-slate-200', icon: 'text-slate-500', iconComp: CalendarIcon };
    const ThemeIcon = theme.iconComp;

    const formatTime = (t: string) => t.slice(0, 5);
    const formatDateBr = (d: string) => {
        if (!d) return '';
        const [year, month, day] = d.split('-');
        return `${day}/${month}/${year}`;
    };

    if (!finalState) return null;

    return createPortal(
        <div
            id="event-pdf-content"
            style={{
                position: 'fixed',
                left: '-10000px',
                top: '0',
                width: '210mm',
                background: 'white',
                zIndex: -1
            }}
        >
            <PageWrapper
                state={{
                    ...finalState,
                    branding: {
                        ...finalState.branding,
                        watermark: {
                            ...finalState.branding?.watermark,
                            enabled: false
                        }
                    },
                    content: {
                        ...finalState.content,
                        title: event.title,
                        protocol: (event.id || '').substring(0, 8).toUpperCase()
                    }
                }}
                pageIndex={0}
                totalPages={1}
                isGenerating={true}
            >
                <div className="flex flex-col gap-8">
                    {/* Título Principal do Relatório */}
                    <div className="border-b-2 border-slate-900 pb-4">
                        <h1 className="text-[18pt] font-black uppercase tracking-tight text-slate-900">Detalhes do Evento</h1>
                        <p className="text-[10pt] font-bold text-slate-500 uppercase tracking-widest mt-1">Informações do Calendário Institucional</p>
                    </div>

                    {/* Bloco de Destaque */}
                    <div className="grid grid-cols-1 gap-6">
                        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                <ThemeIcon className="w-24 h-24" />
                            </div>

                            <div className="relative z-10">
                                <span className={`inline-block px-2.5 py-1 rounded text-[8pt] uppercase font-black tracking-widest bg-white border shadow-sm mb-4 ${theme.border} ${theme.text}`}>
                                    {event.type}
                                </span>
                                <h2 className="text-[22pt] font-black text-slate-900 leading-tight mb-6">{event.title}</h2>

                                <div className="grid grid-cols-2 gap-8 pt-6 border-t border-slate-200">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center shadow-sm">
                                            <CalendarIcon className="w-5 h-5 text-slate-400" />
                                        </div>
                                        <div>
                                            <p className="text-[7pt] font-black uppercase text-slate-400 tracking-wider">Período</p>
                                            <p className="text-[11pt] font-bold text-slate-900">
                                                {event.start_date === event.end_date
                                                    ? formatDateBr(event.start_date)
                                                    : `${formatDateBr(event.start_date)} - ${formatDateBr(event.end_date)}`
                                                }
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center shadow-sm">
                                            <Clock className="w-5 h-5 text-slate-400" />
                                        </div>
                                        <div>
                                            <p className="text-[7pt] font-black uppercase text-slate-400 tracking-wider">Horário</p>
                                            <p className="text-[11pt] font-bold text-slate-900">
                                                {event.is_all_day ? 'Dia Inteiro' : `${formatTime(event.start_time!)} às ${formatTime(event.end_time!)}`}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Descrição */}
                        {event.description && (
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 text-slate-400">
                                    <AlignLeft className="w-4 h-4" />
                                    <h3 className="text-[9pt] font-black uppercase tracking-widest">Descrição</h3>
                                </div>
                                <div className="bg-white border-l-4 border-slate-900 p-5 text-[11pt] text-slate-700 leading-relaxed shadow-sm italic">
                                    {event.description}
                                </div>
                            </div>
                        )}

                        {/* Convidados */}
                        {event.invites && event.invites.length > 0 && (
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 text-slate-400">
                                    <Users className="w-4 h-4" />
                                    <h3 className="text-[9pt] font-black uppercase tracking-widest">Lista de Participantes ({event.invites.length})</h3>
                                </div>

                                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                                    <table className="w-full text-left bg-white">
                                        <thead>
                                            <tr className="bg-slate-900 text-white text-[8pt] uppercase tracking-widest">
                                                <th className="px-5 py-3 font-black">Participante</th>
                                                <th className="px-5 py-3 font-black text-center">Tipo</th>
                                                <th className="px-5 py-3 font-black text-right">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 italic">
                                            {event.invites.map(inv => (
                                                <tr key={inv.id} className="text-[10pt]">
                                                    <td className="px-5 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${inv.role === 'Colaborador' ? 'bg-indigo-50 text-indigo-500' : 'bg-slate-100 text-slate-400'}`}>
                                                                {inv.role === 'Colaborador' ? <Star className="w-4 h-4" /> : <User className="w-4 h-4" />}
                                                            </div>
                                                            <span className="font-bold text-slate-900">{inv.user_name || 'Usuário'}</span>
                                                        </div>
                                                        {inv.status === 'Recusado' && inv.decline_reason && (
                                                            <p className="mt-1 text-[8pt] text-rose-600 pl-11">Motivo: {inv.decline_reason}</p>
                                                        )}
                                                    </td>
                                                    <td className="px-5 py-4 text-center">
                                                        <span className="text-[8pt] font-bold text-slate-500 uppercase tracking-tight">{inv.role === 'Colaborador' ? 'Organizador' : 'Participante'}</span>
                                                    </td>
                                                    <td className="px-5 py-4 text-right">
                                                        <span className={`inline-block px-2 py-0.5 rounded text-[8pt] font-black uppercase tracking-tighter ${inv.status === 'Aceito' ? 'text-emerald-600' :
                                                            inv.status === 'Recusado' ? 'text-rose-600' : 'text-slate-400'
                                                            }`}>
                                                            {inv.status}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Metadados Finais */}
                    <div className="mt-auto grid grid-cols-2 gap-4 text-slate-400 pt-8 border-t border-slate-100">
                        <div>
                            <p className="text-[7pt] font-black uppercase tracking-widest opacity-60">Criado em</p>
                            <p className="text-[9pt] font-medium">{new Date(event.created_at!).toLocaleString('pt-BR')}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-[7pt] font-black uppercase tracking-widest opacity-60">ID do Evento</p>
                            <p className="text-[8pt] font-mono">{event.id}</p>
                        </div>
                    </div>
                </div>
            </PageWrapper>
        </div>,
        document.body
    );
};
