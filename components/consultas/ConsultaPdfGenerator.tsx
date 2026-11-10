import React, { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { AppState, User, ConsultaPaciente, ConsultaProcedimento } from '../../types';
import { PageWrapper } from '../PageWrapper';
import { CalendarDays, User as UserIcon, Activity } from 'lucide-react';
import { getAgentesSaudeItems } from '../../services/agentesSaudeService';
import { formatProcedimentoLabel } from '../../services/consultasService';

interface ConsultaPdfGeneratorProps {
    bookingId: string;
    patient: ConsultaPaciente;
    procedure: ConsultaProcedimento;
    date?: string | null;
    quantity: number;
    priority: 'Normal' | 'Urgência' | 'Especial';
    is_retorno?: boolean;
    retorno_tipo?: string;
    currentUser: User;
    state: AppState;
    solicitationDate?: string;
    appointmentTime?: string;
    status?: string;
    agentPsf?: string;
    responsavelNome?: string;
    createdAt?: string;
    prestador?: string;
    municipio?: string;
    convenio?: string;
    tipoAtendimento?: string;
    queuePosition?: number;
    specialSequence?: number;
    pauseReason?: string;
    documentTitle?: string;
    documentSubtitle?: string;
}

export const ConsultaPdfGenerator: React.FC<ConsultaPdfGeneratorProps> = ({
    bookingId,
    patient,
    procedure,
    date,
    quantity,
    priority,
    is_retorno,
    retorno_tipo,
    currentUser,
    state,
    solicitationDate,
    appointmentTime,
    status,
    agentPsf,
    responsavelNome,
    createdAt,
    prestador,
    municipio,
    convenio,
    tipoAtendimento,
    queuePosition,
    specialSequence,
    pauseReason,
    documentTitle,
    documentSubtitle
}) => {
    const formatDateBr = (d?: string | null) => {
        if (!d) return '';
        const clean = d.split('T')[0];
        const [year, month, day] = clean.split('-');
        if (!year || !month || !day) return d;
        return `${day}/${month}/${year}`;
    };

    const formatDateTimeBr = (d?: string | null) => {
        if (!d) return '';
        const parsed = new Date(d);
        if (isNaN(parsed.getTime())) return formatDateBr(d);
        return parsed.toLocaleString('pt-BR');
    };

    // Determina o status real de forma fiel
    const currentStatus = (status || (date && appointmentTime ? 'Agendado' : 'Fila de espera')).trim();
    const isWaitlist =
        currentStatus.toLowerCase().includes('fila') ||
        currentStatus.toLowerCase().includes('aguardando') ||
        currentStatus.toLowerCase() === 'solicitado' ||
        currentStatus.toLowerCase() === 'pausada';

    const resolvedTitle = documentTitle || 'Comprovante de Agendamento';
    const resolvedSubtitle = documentSubtitle || 'Regulação e Marcação de Exames Municipais';

    // Lista de agentes para lookup imediato de PSF
    const agentesList = useMemo(() => getAgentesSaudeItems(), []);
    const resolvedPsf = useMemo(() => {
        if (agentPsf && agentPsf.trim()) return agentPsf.trim();
        if (!patient?.agente_saude) return '';
        const cleanAgent = patient.agente_saude.trim().toUpperCase();
        const found = agentesList.find(a => a.nome.trim().toUpperCase() === cleanAgent);
        return found?.psf || '';
    }, [agentPsf, patient?.agente_saude, agentesList]);

    // Endereço consolidado do paciente
    const resolvedAddress = useMemo(() => {
        const parts = [patient?.street, patient?.neighborhood, patient?.city]
            .map(v => (v || '').trim())
            .filter(Boolean);
        return parts.length > 0 ? parts.join(' — ') : 'Não informado';
    }, [patient?.street, patient?.neighborhood, patient?.city]);

    // Estilo de badge correspondente ao status
    const getStatusBadgeStyle = (st: string) => {
        const s = st.toLowerCase();
        if (s.includes('agendad')) {
            return 'bg-emerald-600 text-white shadow-sm';
        }
        if (s.includes('fila') || s.includes('aguardando') || s.includes('pausad')) {
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
                        title: resolvedTitle.toUpperCase(),
                        protocol: bookingId.substring(0, 8).toUpperCase()
                    }
                }}
                pageIndex={0}
                totalPages={1}
                isGenerating={true}
            >
                <div className="flex flex-col gap-4 p-2">
                    {/* Header Title */}
                    <div className="border-b-2 border-slate-900 pb-3 flex items-center justify-between">
                        <div>
                            <h1 className="text-[16pt] font-black uppercase tracking-tight text-slate-900">{resolvedTitle}</h1>
                            <p className="text-[8pt] font-bold text-slate-500 uppercase tracking-widest mt-0.5">{resolvedSubtitle}</p>
                        </div>
                        <div className="px-3.5 py-1.5 border border-slate-300 rounded-xl bg-slate-50 text-right">
                            <span className="block text-[6.5pt] font-black uppercase tracking-widest text-slate-400">Protocolo</span>
                            <span className="text-[11pt] font-mono font-black text-slate-900">#{bookingId.substring(0, 8).toUpperCase()}</span>
                        </div>
                    </div>

                    {/* Status & Queue Summary Strip */}
                    <div className="flex items-center justify-between flex-wrap gap-2 bg-slate-100/80 border border-slate-200 rounded-xl px-4 py-2">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className={`inline-block px-3 py-1 rounded-lg text-[7.5pt] font-black uppercase tracking-wider ${getStatusBadgeStyle(currentStatus)}`}>
                                STATUS: {currentStatus.toUpperCase()}
                            </span>
                            {(queuePosition || specialSequence) && (
                                <span className="inline-block px-2.5 py-1 rounded-lg text-[7.5pt] font-black uppercase tracking-wider bg-white border border-slate-300 text-slate-700">
                                    {specialSequence ? `Sequência Especial: ${specialSequence}º` : `Posição na Fila: ${queuePosition}º`}
                                </span>
                            )}
                        </div>
                        <span className="text-[7.5pt] font-black uppercase tracking-wider" style={{ color: priority === 'Especial' ? '#b45309' : priority === 'Urgência' ? '#dc2626' : (is_retorno || retorno_tipo) ? '#0d9488' : '#334155' }}>
                            PRIORIDADE: {priority === 'Especial' ? 'AGENDAMENTO ESPECIAL' : priority === 'Urgência' ? 'URGÊNCIA' : (is_retorno || retorno_tipo) ? `RETORNO — ${(retorno_tipo || '1º RETORNO').toUpperCase()}` : 'NORMAL'}
                        </span>
                    </div>

                    {/* Bloco 1: Dados Completos do Paciente */}
                    <div className="bg-slate-50/60 border border-slate-200 rounded-2xl p-4 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-[0.03] pointer-events-none">
                            <Activity className="w-32 h-32 text-slate-900" />
                        </div>
                        <div className="relative z-10 space-y-2.5">
                            <h4 className="text-[8.5pt] font-black uppercase tracking-widest text-sky-700 flex items-center gap-1.5 border-b border-slate-200/80 pb-1.5">
                                <UserIcon className="w-3.5 h-3.5 text-sky-600" />
                                Dados do Paciente
                            </h4>
                            <div className="grid grid-cols-3 gap-3 text-[8.5pt]">
                                <div className="col-span-2">
                                    <span className="block text-[6.5pt] font-bold uppercase text-slate-400 tracking-wider">Nome Completo</span>
                                    <span className="font-extrabold text-slate-900 text-[9.5pt] uppercase">
                                        {patient?.nickname ? `${patient.name} (${patient.nickname})` : (patient?.name || 'Não informado')}
                                    </span>
                                </div>
                                <div>
                                    <span className="block text-[6.5pt] font-bold uppercase text-slate-400 tracking-wider">CPF</span>
                                    <span className="font-mono font-bold text-slate-800">
                                        {patient?.cpf ? patient.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : 'Não informado'}
                                    </span>
                                </div>

                                <div>
                                    <span className="block text-[6.5pt] font-bold uppercase text-slate-400 tracking-wider">Data de Nascimento</span>
                                    <span className="font-bold text-slate-800">{formatDateBr(patient?.birth_date) || 'Não informada'}</span>
                                </div>
                                <div>
                                    <span className="block text-[6.5pt] font-bold uppercase text-slate-400 tracking-wider">Cartão do SUS (CNS)</span>
                                    <span className="font-mono font-bold text-slate-800">{patient?.sus_number || 'Não informado'}</span>
                                </div>
                                <div>
                                    <span className="block text-[6.5pt] font-bold uppercase text-slate-400 tracking-wider">Telefone / Contato</span>
                                    <span className="font-bold text-slate-800">{patient?.phone || 'Não informado'}</span>
                                </div>

                                <div className="col-span-2">
                                    <span className="block text-[6.5pt] font-bold uppercase text-slate-400 tracking-wider">Endereço (Rua / Bairro / Cidade)</span>
                                    <span className="font-bold text-slate-800 uppercase">{resolvedAddress}</span>
                                </div>
                                <div>
                                    <span className="block text-[6.5pt] font-bold uppercase text-slate-400 tracking-wider">Agente ACS / PSF</span>
                                    <span className="font-bold text-slate-800 uppercase">
                                        {patient?.agente_saude || 'Não informado'}{resolvedPsf ? ` (${resolvedPsf})` : ''}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Bloco 2: Dados Completos da Solicitação / Agendamento */}
                    <div className="bg-slate-50/60 border border-slate-200 rounded-2xl p-4 relative overflow-hidden">
                        <div className="relative z-10 space-y-2.5">
                            <h4 className="text-[8.5pt] font-black uppercase tracking-widest text-indigo-700 flex items-center gap-1.5 border-b border-slate-200/80 pb-1.5">
                                <CalendarDays className="w-3.5 h-3.5 text-indigo-600" />
                                Informações da Solicitação e Agendamento
                            </h4>
                            <div className="grid grid-cols-3 gap-3 text-[8.5pt]">
                                <div className="col-span-2">
                                    <span className="block text-[6.5pt] font-bold uppercase text-slate-400 tracking-wider">Procedimento / Exame / Consulta</span>
                                    <span className="font-extrabold text-slate-900 text-[9.5pt] uppercase">
                                        {procedure ? formatProcedimentoLabel(procedure) : 'Não informado'}
                                    </span>
                                </div>
                                <div>
                                    <span className="block text-[6.5pt] font-bold uppercase text-slate-400 tracking-wider">Categoria / Código</span>
                                    <span className="font-bold text-slate-800 uppercase">
                                        {procedure?.type || 'Geral'}{procedure?.code ? ` • Cód. ${procedure.code}` : ''}
                                    </span>
                                </div>

                                <div>
                                    <span className="block text-[6.5pt] font-bold uppercase text-slate-400 tracking-wider">Data da Solicitação</span>
                                    <span className="font-extrabold text-slate-800">
                                        {formatDateBr(solicitationDate || createdAt || date) || 'Não informada'}
                                    </span>
                                </div>
                                <div>
                                    <span className="block text-[6.5pt] font-bold uppercase text-slate-400 tracking-wider">Data do Atendimento</span>
                                    <span className={`font-extrabold ${isWaitlist && !date ? 'text-amber-700' : 'text-slate-800'}`}>
                                        {date ? formatDateBr(date) : (isWaitlist ? 'Aguardando Vaga' : 'A definir')}
                                    </span>
                                </div>
                                <div>
                                    <span className="block text-[6.5pt] font-bold uppercase text-slate-400 tracking-wider">Horário / Quantidade</span>
                                    <span className={`font-extrabold ${!appointmentTime ? 'text-amber-700' : 'text-slate-800'}`}>
                                        {appointmentTime ? appointmentTime.substring(0, 5) : (isWaitlist ? 'Aguardando Vaga' : 'A definir')} • Qtd: {quantity || 1}
                                    </span>
                                </div>

                                <div>
                                    <span className="block text-[6.5pt] font-bold uppercase text-slate-400 tracking-wider">Tipo de Atendimento</span>
                                    <span className="font-bold text-slate-800 uppercase">{tipoAtendimento || 'Não definido'}</span>
                                </div>
                                <div>
                                    <span className="block text-[6.5pt] font-bold uppercase text-slate-400 tracking-wider">Prestador / Unidade</span>
                                    <span className="font-bold text-slate-800 uppercase">{prestador || 'A definir'}</span>
                                </div>
                                <div>
                                    <span className="block text-[6.5pt] font-bold uppercase text-slate-400 tracking-wider">Município / Convênio</span>
                                    <span className="font-bold text-slate-800 uppercase">
                                        {[municipio, convenio].filter(Boolean).join(' • ') || 'A definir'}
                                    </span>
                                </div>

                                {pauseReason && (
                                    <div className="col-span-3 pt-1 border-t border-slate-200/70">
                                        <span className="block text-[6.5pt] font-bold uppercase text-amber-600 tracking-wider">Observação / Motivo da Pausa</span>
                                        <span className="font-bold text-slate-700">{pauseReason}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Informações de Auditoria e Rastreabilidade */}
                    <div className="grid grid-cols-2 gap-6 pt-3 mt-1 border-t border-slate-200">
                        <div className="space-y-1 text-[8pt]">
                            <span className="block text-[6.5pt] font-black uppercase tracking-widest text-slate-400">Responsável pelo Cadastro Original</span>
                            <div className="font-bold text-slate-800">{responsavelNome || currentUser.name}</div>
                            {createdAt && (
                                <div className="text-[7.5pt] text-slate-500 font-semibold">
                                    Registrado em: {formatDateTimeBr(createdAt)}
                                </div>
                            )}
                            {responsavelNome && responsavelNome !== currentUser.name && (
                                <div className="text-[7pt] text-slate-400 font-semibold">
                                    2ª via emitida por: {currentUser.name}
                                </div>
                            )}
                        </div>
                        <div className="space-y-1 text-[8pt] text-right">
                            <span className="block text-[6.5pt] font-black uppercase tracking-widest text-slate-400">Autenticação do Sistema</span>
                            <div className="font-mono text-[7.5pt] text-slate-600 font-bold uppercase tracking-wider">{bookingId}</div>
                            <div className="text-[7.5pt] text-slate-400 font-semibold">
                                Emitido em: {new Date().toLocaleString('pt-BR')}
                            </div>
                        </div>
                    </div>

                    {/* Nota de rodapé legal */}
                    <div className="mt-1 p-3 bg-slate-50 border border-slate-200/80 rounded-xl text-center text-[6.8pt] font-bold uppercase tracking-wider text-slate-500 leading-relaxed">
                        Este é um documento oficial emitido eletronicamente pela Secretaria Municipal de Saúde. O paciente deve apresentar-se no local do atendimento portando este comprovante, documento com foto e cartão do SUS.
                    </div>
                </div>
            </PageWrapper>
        </div>,
        document.body
    );
};

