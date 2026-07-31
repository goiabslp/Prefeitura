import React from 'react';
import { createPortal } from 'react-dom';
import { AppState, User, ConsultaPaciente, ConsultaProcedimento } from '../../types';
import { PageWrapper } from '../PageWrapper';
import { CalendarDays, User as UserIcon, Clock, Activity, ShieldCheck, FileText } from 'lucide-react';

interface ConsultaPdfGeneratorProps {
    bookingId: string;
    patient: ConsultaPaciente;
    procedure: ConsultaProcedimento;
    date: string;
    quantity: number;
    priority: 'Normal' | 'Urgência';
    is_retorno?: boolean;
    currentUser: User;
    state: AppState;
    solicitationDate?: string;
    appointmentTime?: string;
    status?: string;
}

export const ConsultaPdfGenerator: React.FC<ConsultaPdfGeneratorProps> = ({
    bookingId,
    patient,
    procedure,
    date,
    quantity,
    priority,
    is_retorno,
    currentUser,
    state,
    solicitationDate,
    appointmentTime,
    status
}) => {
    const formatDateBr = (d?: string) => {
        if (!d) return '';
        const [year, month, day] = d.split('-');
        if (!year || !month || !day) return d;
        return `${day}/${month}/${year}`;
    };

    const isWaitlist = status === 'Fila de espera' || !appointmentTime;

    return createPortal(
        <div
            id="consulta-pdf-content"
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
                    ...state,
                    branding: {
                        ...state.branding,
                        watermark: {
                            ...state.branding?.watermark,
                            enabled: false
                        }
                    },
                    content: {
                        ...state.content,
                        title: 'COMPROVANTE DE AGENDAMENTO',
                        protocol: bookingId.substring(0, 8).toUpperCase()
                    }
                }}
                pageIndex={0}
                totalPages={1}
                isGenerating={true}
            >
                <div className="flex flex-col gap-8 p-4">
                    {/* Header Title */}
                    <div className="border-b-2 border-slate-900 pb-4 flex items-center justify-between">
                        <div>
                            <h1 className="text-[18pt] font-black uppercase tracking-tight text-slate-900">Comprovante de Agendamento</h1>
                            <p className="text-[9pt] font-bold text-slate-500 uppercase tracking-widest mt-1">Regulação e Marcação de Exames Municipais</p>
                        </div>
                        <div className="px-4 py-2 border border-slate-200 rounded-xl bg-slate-50 text-right">
                            <span className="block text-[7pt] font-black uppercase tracking-widest text-slate-400">Protocolo</span>
                            <span className="text-[11pt] font-mono font-black text-slate-800">{bookingId.substring(0, 8).toUpperCase()}</span>
                        </div>
                    </div>

                    {/* Voucher Card details */}
                    <div className="grid grid-cols-1 gap-6">
                        <div className="bg-slate-50/50 border border-slate-200 rounded-2xl p-6 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-6 opacity-[0.03]">
                                <Activity className="w-48 h-48 text-slate-900" />
                            </div>

                            <div className="relative z-10 space-y-6">
                                <span className={`inline-block px-3 py-1 rounded text-[8pt] uppercase font-black tracking-widest ${
                                    isWaitlist ? 'bg-amber-100 text-amber-800' : 'bg-sky-600 text-white'
                                }`}>
                                    Status: {status || (isWaitlist ? 'Fila de espera' : 'Agendado')}
                                </span>

                                <div className="grid grid-cols-2 gap-8 border-t border-slate-200/80 pt-6">
                                    <div className="space-y-4">
                                        <h4 className="text-[9pt] font-black uppercase tracking-widest text-sky-600 flex items-center gap-2">
                                            <UserIcon className="w-4 h-4 text-sky-600" />
                                            Dados do Paciente
                                        </h4>
                                        <div className="space-y-2 text-xs">
                                            <div>
                                                <span className="block text-[7pt] font-bold uppercase text-slate-400 tracking-wider">Nome Completo</span>
                                                <span className="font-extrabold text-slate-800 text-sm">{patient.nickname ? `${patient.name} (${patient.nickname})` : patient.name}</span>
                                            </div>
                                            <div>
                                                <span className="block text-[7pt] font-bold uppercase text-slate-400 tracking-wider">CPF</span>
                                                <span className="font-bold text-slate-800">{patient.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")}</span>
                                            </div>
                                            <div>
                                                <span className="block text-[7pt] font-bold uppercase text-slate-400 tracking-wider">Data de Nascimento</span>
                                                <span className="font-bold text-slate-800">{formatDateBr(patient.birth_date)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <h4 className="text-[9pt] font-black uppercase tracking-widest text-indigo-600 flex items-center gap-2">
                                            <CalendarDays className="w-4 h-4 text-indigo-600" />
                                            Dados do Agendamento
                                        </h4>
                                        <div className="space-y-2 text-xs">
                                            <div>
                                                <span className="block text-[7pt] font-bold uppercase text-slate-400 tracking-wider">Procedimento / Exame</span>
                                                <span className="font-extrabold text-slate-800 text-sm uppercase">{procedure.name}</span>
                                            </div>
                                            <div>
                                                <span className="block text-[7pt] font-bold uppercase text-slate-400 tracking-wider">Data da Solicitação</span>
                                                <span className="font-extrabold text-slate-800">{formatDateBr(solicitationDate || date)}</span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <span className="block text-[7pt] font-bold uppercase text-slate-400 tracking-wider">Data e Hora</span>
                                                    <span className={`font-extrabold ${isWaitlist ? 'text-amber-700 font-bold' : 'text-slate-800'}`}>
                                                        {!isWaitlist
                                                            ? `${formatDateBr(date)}${appointmentTime ? ' às ' + appointmentTime.substring(0, 5) : ''}`
                                                            : 'Aguardando Vaga'}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="block text-[7pt] font-bold uppercase text-slate-400 tracking-wider">Prioridade</span>
                                                    <span className="font-bold text-slate-800 uppercase" style={{ color: priority === 'Urgência' ? '#dc2626' : is_retorno ? '#0d9488' : '#475569' }}>
                                                        {priority === 'Urgência' ? 'Urgência' : is_retorno ? 'Retorno' : 'Normal'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Informações de Auditoria e Assinatura */}
                        <div className="grid grid-cols-2 gap-8 pt-8 mt-12 border-t border-slate-100">
                            <div className="space-y-2 text-xs">
                                <span className="block text-[7pt] font-black uppercase tracking-widest text-slate-400">Responsável pelo Registro</span>
                                <div className="font-bold text-slate-800">{currentUser.name}</div>
                                <div className="text-[8pt] text-slate-400 font-semibold">{currentUser.jobTitle || 'Agente Administrativo'}</div>
                            </div>
                            <div className="space-y-2 text-xs text-right">
                                <span className="block text-[7pt] font-black uppercase tracking-widest text-slate-400">Autenticação do Sistema</span>
                                <div className="font-mono text-[8pt] text-slate-500 font-bold uppercase tracking-wider">{bookingId}</div>
                                <div className="text-[8pt] text-slate-400 font-semibold">{new Date().toLocaleString('pt-BR')}</div>
                            </div>
                        </div>

                        {/* Nota de rodapé legal */}
                        <div className="mt-12 p-4 bg-slate-50 border border-slate-200/80 rounded-xl text-center text-[7pt] font-bold uppercase tracking-wider text-slate-400 leading-relaxed">
                            Este é um documento oficial emitido eletronicamente pela Secretaria Municipal de Saúde. O paciente deve apresentar-se no local do atendimento portando este comprovante, documento com foto e cartão do SUS.
                        </div>
                    </div>
                </div>
            </PageWrapper>
        </div>,
        document.body
    );
};
