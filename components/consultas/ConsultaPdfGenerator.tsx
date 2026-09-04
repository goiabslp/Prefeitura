import React, { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { AppState, User, ConsultaPaciente, ConsultaProcedimento } from '../../types';
import { PageWrapper } from '../PageWrapper';
import { CalendarDays, User as UserIcon, Activity } from 'lucide-react';
import { getAgentesSaudeItems } from '../../services/agentesSaudeService';

interface ConsultaPdfGeneratorProps {
    bookingId: string;
    patient: ConsultaPaciente;
    procedure: ConsultaProcedimento;
    date?: string | null;
    quantity: number;
    priority: 'Normal' | 'Urgência' | 'Especial';
    is_retorno?: boolean;
    currentUser: User;
    state: AppState;
    solicitationDate?: string;
    appointmentTime?: string;
    status?: string;
    agentPsf?: string;
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
    status,
    agentPsf
}) => {
    const formatDateBr = (d?: string | null) => {
        if (!d) return '';
        const clean = d.split('T')[0];
        const [year, month, day] = clean.split('-');
        if (!year || !month || !day) return d;
        return `${day}/${month}/${year}`;
    };

    // Determina o status real de forma fiel
    const currentStatus = (status || (date && appointmentTime ? 'Agendado' : 'Fila de espera')).trim();
    const isWaitlist = currentStatus.toLowerCase() === 'fila de espera' || currentStatus.toLowerCase() === 'aguardando data';

    // Lista de agentes para lookup imediato de PSF
    const agentesList = useMemo(() => getAgentesSaudeItems(), []);
    const resolvedPsf = useMemo(() => {
        if (agentPsf && agentPsf.trim()) return agentPsf.trim();
        if (!patient?.agente_saude) return '';
        const cleanAgent = patient.agente_saude.trim().toUpperCase();
        const found = agentesList.find(a => a.nome.trim().toUpperCase() === cleanAgent);
        return found?.psf || '';
    }, [agentPsf, patient?.agente_saude, agentesList]);

    // Estilo de badge correspondente ao status
    const getStatusBadgeStyle = (st: string) => {
        const s = st.toLowerCase();
        if (s.includes('agendad')) {
            return 'bg-emerald-600 text-white shadow-sm';
        }
        if (s.includes('fila') || s.includes('aguardando')) {
            return 'bg-amber-100 text-amber-900 border border-amber-300 font-black';
        }
        if (s.includes('solicitad')) {
            return 'bg-sky-600 text-white shadow-sm';
        }
        if (s.includes('realizad')) {
            return 'bg-blue-700 text-white shadow-sm';
        }
        if (s.includes('cancel') || s.includes('não')) {
            return 'bg-rose-600 text-white shadow-sm';
        }
        if (s.includes('retorno')) {
            return 'bg-teal-600 text-white shadow-sm';
        }
        return 'bg-slate-700 text-white';
    };

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
                                <span className={`inline-block px-3.5 py-1.5 rounded-lg text-[8pt] uppercase tracking-wider ${getStatusBadgeStyle(currentStatus)}`}>
                                    STATUS: {currentStatus.toUpperCase()}
                                </span>

                                <div className="grid grid-cols-2 gap-8 border-t border-slate-200/80 pt-6">
                                    {/* Dados do Paciente */}
                                    <div className="space-y-4">
                                        <h4 className="text-[9pt] font-black uppercase tracking-widest text-sky-600 flex items-center gap-2">
                                            <UserIcon className="w-4 h-4 text-sky-600" />
                                            Dados do Paciente
                                        </h4>
                                        <div className="space-y-3 text-xs">
                                            <div>
                                                <span className="block text-[7pt] font-bold uppercase text-slate-400 tracking-wider">Nome Completo</span>
                                                <span className="font-extrabold text-slate-800 text-sm">{patient.nickname ? `${patient.name} (${patient.nickname})` : patient.name}</span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <span className="block text-[7pt] font-bold uppercase text-slate-400 tracking-wider">CPF</span>
                                                    <span className="font-bold text-slate-800">{patient.cpf ? patient.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4") : 'Não informado'}</span>
                                                </div>
                                                <div>
                                                    <span className="block text-[7pt] font-bold uppercase text-slate-400 tracking-wider">Data de Nascimento</span>
                                                    <span className="font-bold text-slate-800">{formatDateBr(patient.birth_date) || 'Não informada'}</span>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4 pt-1 border-t border-slate-200/50">
                                                <div>
                                                    <span className="block text-[7pt] font-bold uppercase text-slate-400 tracking-wider">Agente de Saúde (ACS)</span>
                                                    <span className="font-bold text-slate-800 uppercase">{patient.agente_saude || 'Não informado'}</span>
                                                </div>
                                                <div>
                                                    <span className="block text-[7pt] font-bold uppercase text-slate-400 tracking-wider">Unidade PSF</span>
                                                    <span className="font-bold text-slate-800 uppercase">{resolvedPsf || 'Não informado'}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Dados do Agendamento */}
                                    <div className="space-y-4">
                                        <h4 className="text-[9pt] font-black uppercase tracking-widest text-indigo-600 flex items-center gap-2">
                                            <CalendarDays className="w-4 h-4 text-indigo-600" />
                                            Dados do Agendamento
                                        </h4>
                                        <div className="space-y-3 text-xs">
                                            <div>
                                                <span className="block text-[7pt] font-bold uppercase text-slate-400 tracking-wider">Procedimento / Exame</span>
                                                <span className="font-extrabold text-slate-800 text-sm uppercase">{procedure.name}</span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <span className="block text-[7pt] font-bold uppercase text-slate-400 tracking-wider">Data do Agendamento</span>
                                                    <span className={`font-extrabold ${isWaitlist && !date ? 'text-amber-700' : 'text-slate-800'}`}>
                                                        {date ? formatDateBr(date) : (isWaitlist ? 'Aguardando Vaga' : 'A definir')}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="block text-[7pt] font-bold uppercase text-slate-400 tracking-wider">Hora do Agendamento</span>
                                                    <span className={`font-extrabold ${!appointmentTime ? 'text-amber-700' : 'text-slate-800'}`}>
                                                        {appointmentTime ? appointmentTime.substring(0, 5) : (isWaitlist ? 'Aguardando Vaga' : 'A definir')}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4 pt-1 border-t border-slate-200/50">
                                                <div>
                                                    <span className="block text-[7pt] font-bold uppercase text-slate-400 tracking-wider">Data da Solicitação</span>
                                                    <span className="font-bold text-slate-700">
                                                        {formatDateBr(solicitationDate || date) || 'Não informada'}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="block text-[7pt] font-bold uppercase text-slate-400 tracking-wider">Prioridade</span>
                                                    <span className="font-extrabold uppercase" style={{ color: priority === 'Especial' ? '#d97706' : priority === 'Urgência' ? '#dc2626' : is_retorno ? '#0d9488' : '#334155' }}>
                                                        {priority === 'Especial' ? 'Especial' : priority === 'Urgência' ? 'Urgência' : is_retorno ? 'Retorno' : 'Normal'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Informações de Auditoria e Assinatura */}
                        <div className="grid grid-cols-2 gap-8 pt-8 mt-8 border-t border-slate-100">
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
                        <div className="mt-8 p-4 bg-slate-50 border border-slate-200/80 rounded-xl text-center text-[7pt] font-bold uppercase tracking-wider text-slate-400 leading-relaxed">
                            Este é um documento oficial emitido eletronicamente pela Secretaria Municipal de Saúde. O paciente deve apresentar-se no local do atendimento portando este comprovante, documento com foto e cartão do SUS.
                        </div>
                    </div>
                </div>
            </PageWrapper>
        </div>,
        document.body
    );
};

