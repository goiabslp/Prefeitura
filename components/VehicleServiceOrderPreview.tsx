import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { AppState, VehicleSchedule, Vehicle, Person, Sector } from '../types';
import { PageWrapper } from './PageWrapper';
import { Car, User, MapPin, Calendar, Clock, Target, Building2, Ticket, X, Printer, ShieldCheck, CheckCircle2, History, XCircle } from 'lucide-react';

const STATUS_MAP: any = {
    pendente: { label: 'Aguardando Aprovação', color: 'amber', icon: Clock },
    confirmado: { label: 'Agendamento Confirmado', color: 'emerald', icon: CheckCircle2 },
    em_curso: { label: 'Viagem em Curso', color: 'blue', icon: MapPin },
    concluido: { label: 'Serviço Concluído', color: 'slate', icon: History },
    cancelado: { label: 'Cancelado/Rejeitado', color: 'rose', icon: XCircle },
};

interface VehicleServiceOrderPreviewProps {
    schedule: VehicleSchedule;
    vehicle: Vehicle;
    driver: Person;
    requester?: Person;
    sector?: Sector;
    state: AppState;
    onClose: () => void;
}

export const VehicleServiceOrderPreview: React.FC<VehicleServiceOrderPreviewProps> = ({
    schedule,
    vehicle,
    driver,
    requester,
    sector,
    state,
    onClose
}) => {
    // Construct a synthetic state for the PageWrapper to use standard headers/footers
    // We override specific content fields to match the context of a Service Order
    const previewState: AppState = {
        ...state,
        document: {
            ...state.document,
            showSignature: false
        },
        branding: {
            ...state.branding,
            watermark: {
                ...state.branding.watermark,
                enabled: false
            }
        },
        content: {
            ...state.content,
            title: "ORDEM DE TRÁFEGO / SERVIÇO",
            protocol: schedule.protocol,
            signatureSector: sector?.name || 'Setor de Transportes',
            // We don't necessarily use the standard body text, we render custom children
        }
    };

    const [isGenerating, setIsGenerating] = useState(false);

    const handleDownloadPdf = async () => {
        setIsGenerating(true);
        // Aguarda o re-render com escala 1.0 e sem sombras
        setTimeout(async () => {
            const element = document.getElementById('os-preview-content');
            if (element) {
                const opt = {
                    margin: 0,
                    filename: `Ordem-Servico-${schedule.protocol}.pdf`,
                    image: { type: 'jpeg', quality: 0.98 },
                    html2canvas: {
                        scale: 2,
                        useCORS: true,
                        letterRendering: true,
                        scrollY: 0,
                        scrollX: 0
                    },
                    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
                    pagebreak: { mode: 'css' }
                };
                // @ts-ignore
                await window.html2pdf().from(element).set(opt).save();
            }
            setIsGenerating(false);
        }, 300);
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
    };

    const formatTime = (dateStr: string) => {
        return new Date(dateStr).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    };

    return createPortal(
        <div className={`fixed inset-0 z-[9999] bg-slate-900/40 backdrop-blur-xl animate-fade-in ${isGenerating ? 'bg-white' : ''}`}>

            {/* Camada de Interface (Botões Fixos) */}
            {!isGenerating && (
                <div className="hidden xl:block">
                    <div className="fixed left-12 top-12 z-[100]">
                        <button
                            onClick={handleDownloadPdf}
                            disabled={isGenerating}
                            className="group px-6 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest text-[11px] rounded-2xl transition-all shadow-2xl shadow-indigo-500/30 active:scale-95 flex items-center gap-3 border border-indigo-400/50 disabled:opacity-50"
                        >
                            <Printer className="w-5 h-5 group-hover:scale-110 transition-transform" />
                            <span>{isGenerating ? 'Gerando...' : 'Gerar PDF / Imprimir'}</span>
                        </button>
                    </div>

                    <div className="fixed right-12 top-12 z-[100]">
                        <button
                            onClick={onClose}
                            className="group px-6 py-4 bg-white hover:bg-rose-50 text-slate-500 hover:text-rose-600 font-black uppercase tracking-widest text-[11px] rounded-2xl transition-all shadow-2xl border border-slate-200 active:scale-95 flex items-center gap-3"
                        >
                            <X className="w-5 h-5 group-hover:rotate-90 transition-transform" />
                            <span>Fechar Visualização</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Camada de Rolagem (Conteúdo do Documento) */}
            <div className={`fixed inset-0 overflow-y-auto flex items-start justify-center p-4 md:p-8 ${isGenerating ? 'p-0' : ''}`}>
                <div className={`relative w-full max-w-4xl min-h-full flex flex-col items-center py-12 ${isGenerating ? 'py-0' : ''}`}>
                    {/* Botões Mobile/Tablet (Scrollam com o conteúdo) */}
                    {!isGenerating && (
                        <div className="flex xl:hidden w-full max-w-[800px] gap-3 mb-8 px-4">
                            <button onClick={handleDownloadPdf} className="flex-1 py-4 bg-indigo-600 text-white font-black uppercase tracking-widest text-[11px] rounded-2xl shadow-xl flex items-center justify-center gap-2">
                                <Printer className="w-4 h-4" /> {isGenerating ? 'Gerando...' : 'PDF'}
                            </button>
                            <button onClick={onClose} className="flex-1 py-4 bg-white text-slate-500 font-black uppercase tracking-widest text-[11px] rounded-2xl shadow-xl border border-slate-100 flex items-center justify-center gap-2">
                                <X className="w-4 h-4" /> Fechar
                            </button>
                        </div>
                    )}

                    {/* Document Scale Wrapper */}
                    <div className={`${isGenerating ? 'bg-white p-0' : 'bg-slate-200/50 p-8 rounded-[2rem] shadow-2xl'} overflow-hidden w-full flex justify-center`}>
                        <div id="os-preview-content" className={`${isGenerating ? 'scale-100 transform-none' : 'scale-[0.6] sm:scale-[0.7] md:scale-[0.8] lg:scale-[0.9]'} origin-top transition-all duration-300 bg-white`}>
                            <PageWrapper state={previewState} pageIndex={0} totalPages={2} isGenerating={isGenerating}>
                                <div className="flex flex-col gap-3 mt-2 relative">
                                    {/* Watermark for Cancelled */}
                                    {schedule.status === 'cancelado' && (
                                        <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none overflow-hidden">
                                            <div className="transform -rotate-45 text-rose-500/10 text-[100pt] font-black uppercase whitespace-nowrap border-8 border-rose-500/10 px-20 py-4 rounded-3xl">
                                                CANCELADO
                                            </div>
                                        </div>
                                    )}

                                    {/* Cancellation Details Box */}
                                    {schedule.status === 'cancelado' && (
                                        <div className="bg-rose-50 border-2 border-rose-100 rounded-xl p-4 mb-2 relative z-10">
                                            <div className="flex items-start gap-4">
                                                <div className="p-3 bg-white rounded-xl shadow-sm border border-rose-100 text-rose-500">
                                                    <XCircle className="w-6 h-6" />
                                                </div>
                                                <div className="flex-1">
                                                    <h3 className="text-[10pt] font-black uppercase text-rose-700 tracking-tight mb-1">Solicitação Cancelada</h3>
                                                    <p className="text-[9pt] font-medium text-rose-900/80 italic mb-2">"{schedule.cancellationReason || 'Sem justificativa informada.'}"</p>
                                                    <div className="flex items-center gap-4 text-[7pt] uppercase tracking-widest text-rose-400 font-bold">
                                                        <span className="flex items-center gap-1"><User className="w-3 h-3" /> Por: {schedule.cancelledBy || 'Sistema'}</span>
                                                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Em: {schedule.cancelledAt ? new Date(schedule.cancelledAt).toLocaleString('pt-BR') : '---'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Status and Creation Section - Compact Grid */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="border border-slate-100 rounded-lg p-2.5 bg-slate-50 flex items-center gap-3">
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-${STATUS_MAP[schedule.status].color}-100 text-${STATUS_MAP[schedule.status].color}-600 shrink-0`}>
                                                {React.createElement(STATUS_MAP[schedule.status].icon, { className: "w-4 h-4" })}
                                            </div>
                                            <div>
                                                <p className="text-[6pt] font-black uppercase text-slate-400 tracking-widest leading-none mb-0.5">Status</p>
                                                <p className={`text-[9pt] font-black uppercase tracking-tight text-${STATUS_MAP[schedule.status].color}-700`}>
                                                    {STATUS_MAP[schedule.status].label}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="border border-slate-200 rounded-lg p-2.5 bg-white flex flex-col justify-center">
                                            <p className="text-[7pt] font-black uppercase text-slate-400 tracking-widest mb-0.5 flex items-center gap-1">
                                                <Clock className="w-2.5 h-2.5" /> Registrado em:
                                            </p>
                                            <p className="text-[9pt] font-bold text-slate-700">
                                                {new Date(schedule.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Summary Cards - Compact */}
                                    <div className="grid grid-cols-2 gap-3">
                                        {/* Vehicle Card - Conditionally Visible */}
                                        {vehicle.sectorId === sector?.id ? (
                                            <div className="p-3 border border-slate-200 rounded-lg bg-slate-50 relative overflow-hidden">
                                                <div className="absolute right-0 top-0 p-2 opacity-5">
                                                    <Car className="w-16 h-16" />
                                                </div>
                                                <div className="relative z-10">
                                                    <h3 className="text-[8pt] font-black uppercase tracking-widest text-slate-400 mb-1 flex items-center gap-1.5">
                                                        <Car className="w-3 h-3" /> Veículo
                                                    </h3>
                                                    <div className="space-y-0.5">
                                                        <p className="text-[11pt] font-black text-slate-800">{vehicle.model}</p>
                                                        <div className="flex gap-2 text-[8pt]">
                                                            <span className="font-mono bg-slate-200 px-1.5 py-px rounded text-slate-600">{vehicle.plate}</span>
                                                            <span className="text-slate-500">{vehicle.type.toUpperCase()}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="p-3 border border-slate-100 rounded-lg bg-slate-50/50 flex items-center justify-center">
                                                <p className="text-[9pt] font-bold text-slate-400 uppercase tracking-widest italic text-center">
                                                    Dados do veículo restritos
                                                </p>
                                            </div>
                                        )}

                                        {/* Driver Card */}
                                        <div className="p-3 border border-slate-200 rounded-lg bg-slate-50 relative overflow-hidden">
                                            <div className="absolute right-0 top-0 p-2 opacity-5">
                                                <User className="w-16 h-16" />
                                            </div>
                                            <div className="relative z-10">
                                                <h3 className="text-[8pt] font-black uppercase tracking-widest text-slate-400 mb-1 flex items-center gap-1.5">
                                                    <User className="w-3 h-3" /> Condutor
                                                </h3>
                                                <div className="space-y-0.5">
                                                    <p className="text-[10pt] font-bold text-slate-800">{driver.name}</p>
                                                    <p className="text-[8pt] text-slate-500">{driver.jobId ? 'Motorista Oficial' : 'Condutor Autorizado'}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Requester Info - Compact */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="border border-slate-200 rounded-lg p-2.5 bg-white flex flex-col justify-center">
                                            <p className="text-[7pt] font-black uppercase text-slate-400 tracking-widest mb-0.5 flex items-center gap-1">
                                                <Building2 className="w-2.5 h-2.5" /> Solicitante (Setor)
                                            </p>
                                            <p className="text-[9pt] font-bold text-slate-700 truncate">{sector?.name || '---'}</p>
                                        </div>
                                        <div className="border border-slate-200 rounded-lg p-2.5 bg-white flex flex-col justify-center">
                                            <p className="text-[7pt] font-black uppercase text-slate-400 tracking-widest mb-0.5 flex items-center gap-1">
                                                <User className="w-2.5 h-2.5" /> Solicitado Por
                                            </p>
                                            <p className="text-[9pt] font-bold text-slate-700 truncate">{requester?.name || '---'}</p>
                                        </div>
                                    </div>

                                    {/* Trip Details Section - Compact */}
                                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                                        <div className="bg-slate-100 px-3 py-1.5 border-b border-slate-200">
                                            <h3 className="text-[8pt] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
                                                <MapPin className="w-3 h-3" /> Viagem
                                            </h3>
                                        </div>
                                        <div className="p-3 grid grid-cols-2 gap-y-3 gap-x-4 bg-white">
                                            <div className="space-y-1">
                                                <p className="text-[7pt] font-bold uppercase text-slate-400 tracking-wide flex items-center gap-1">
                                                    <Calendar className="w-3 h-3" /> Saída
                                                </p>
                                                <p className="text-[9pt] font-medium text-slate-800">
                                                    {formatDate(schedule.departureDateTime)} <span className="text-slate-300 mx-1">|</span> {formatTime(schedule.departureDateTime)}
                                                </p>
                                            </div>

                                            <div className="space-y-1">
                                                <p className="text-[7pt] font-bold uppercase text-slate-400 tracking-wide flex items-center gap-1">
                                                    <Calendar className="w-3 h-3" /> Retorno
                                                </p>
                                                <p className="text-[9pt] font-medium text-slate-800">
                                                    {schedule.returnDateTime ? formatDate(schedule.returnDateTime) : '---'} <span className="text-slate-300 mx-1">|</span> {schedule.returnDateTime ? formatTime(schedule.returnDateTime) : '---'}
                                                </p>
                                            </div>

                                            <div className="col-span-2 space-y-1 pt-2 border-t border-dashed border-slate-100">
                                                <p className="text-[7pt] font-bold uppercase text-slate-400 tracking-wide flex items-center gap-1">
                                                    <MapPin className="w-3 h-3" /> Destino
                                                </p>
                                                <p className="text-[10pt] font-bold text-slate-800 uppercase leading-snug">
                                                    {schedule.destination}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Crew / Passengers Section - Compact */}
                                    {schedule.passengers && schedule.passengers.length > 0 && (
                                        <div className="border border-slate-200 rounded-lg overflow-hidden">
                                            <div className="bg-slate-100 px-3 py-1.5 border-b border-slate-200">
                                                <h3 className="text-[8pt] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
                                                    <User className="w-3 h-3" /> Tripulação
                                                </h3>
                                            </div>
                                            <div className="bg-white">
                                                <table className="w-full text-left border-collapse">
                                                    <thead>
                                                        <tr className="bg-slate-50 border-b border-slate-200 text-[6pt] font-black uppercase tracking-widest text-slate-400">
                                                            <th className="p-2 pl-3 w-1/4">Nome</th>
                                                            <th className="p-2 w-1/4">Partida</th>
                                                            <th className="p-2 w-1/6">Horário</th>
                                                            <th className="p-2 w-1/4">Local</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100">
                                                        {schedule.passengers.map((p, idx) => (
                                                            <tr key={idx} className="text-[7pt] font-medium text-slate-700">
                                                                <td className="p-2 pl-3 font-bold uppercase text-slate-800 truncate">{p.name}</td>
                                                                <td className="p-2 uppercase truncate">{p.departureLocation}</td>
                                                                <td className="p-2 font-mono">{p.appointmentTime}</td>
                                                                <td className="p-2 uppercase truncate">{p.appointmentLocation}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}

                                    {/* Objective Section - Compact */}
                                    <div className="border border-slate-200 rounded-lg overflow-hidden flex-1">
                                        <div className="bg-slate-100 px-3 py-1.5 border-b border-slate-200">
                                            <h3 className="text-[8pt] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
                                                <Target className="w-3 h-3" /> Objetivo
                                            </h3>
                                        </div>
                                        <div className="p-3 bg-white h-full">
                                            <p className="text-[9pt] leading-relaxed text-justify text-slate-700 line-clamp-[10]">
                                                {schedule.purpose}
                                            </p>
                                        </div>
                                    </div>

                                </div>
                            </PageWrapper>

                            <div className="html2pdf__page-break" style={{ pageBreakBefore: 'always' }} />

                            <PageWrapper state={previewState} pageIndex={1} totalPages={2} isGenerating={isGenerating}>
                                <div className="flex flex-col gap-3 mt-1 relative">
                                    <h3 className="text-[10pt] font-black text-slate-800 uppercase tracking-widest text-center border-b border-slate-200 pb-2">
                                        CHECKLIST DO VEÍCULO
                                    </h3>

                                    {/* Hora de Entrada e Entrega */}
                                    <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-xl border border-slate-200">
                                        <div className="flex items-center justify-between px-2">
                                            <span className="text-[8pt] font-black text-slate-500 uppercase tracking-wider">Hora de Entrada no Veículo:</span>
                                            <span className="text-[9pt] font-mono font-bold text-slate-700">______ : ______ h</span>
                                        </div>
                                        <div className="flex items-center justify-between px-2 border-l border-slate-200">
                                            <span className="text-[8pt] font-black text-slate-500 uppercase tracking-wider">Hora de Entrega do Veículo:</span>
                                            <span className="text-[9pt] font-mono font-bold text-slate-700">______ : ______ h</span>
                                        </div>
                                    </div>

                                    {/* Tabela do Checklist */}
                                    <div className="border border-slate-200 rounded-xl overflow-hidden mt-1 bg-white">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-slate-100 border-b border-slate-200 text-[6pt] font-black uppercase tracking-widest text-slate-500">
                                                    <th className="p-1.5 pl-4">Item Verificado</th>
                                                    <th className="p-1.5 text-center w-16">SIM</th>
                                                    <th className="p-1.5 text-center w-28">NÃO ADEQUADO</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 text-[7pt] text-slate-700 font-bold">
                                                {[
                                                    "Combustível suficiente",
                                                    "Óleo do motor",
                                                    "Água do radiador",
                                                    "Funcionamento dos faróis",
                                                    "Funcionamento das lanternas",
                                                    "Funcionamento das setas",
                                                    "Funcionamento das luzes de freio",
                                                    "Pneus em bom estado",
                                                    "Calibragem dos pneus",
                                                    "Estepe em condições de uso",
                                                    "Macaco",
                                                    "Chave de roda",
                                                    "Triângulo de sinalização",
                                                    "Cintos de segurança",
                                                    "Limpadores de para-brisa",
                                                    "Limpeza geral do veículo",
                                                    "Ausência de avarias aparentes"
                                                ].map((item, index) => (
                                                    <tr key={index} className="hover:bg-slate-50/50">
                                                        <td className="p-1 pl-4 uppercase font-bold text-slate-800">{item}</td>
                                                        <td className="p-1 text-center text-slate-300 text-lg font-light">☐</td>
                                                        <td className="p-1 text-center text-slate-300 text-lg font-light">☐</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Assinatura */}
                                    <div className="mt-4 pt-6 border-t border-dashed border-slate-200 flex flex-col items-center">
                                        <p className="text-[8pt] font-black text-slate-600 uppercase tracking-widest">
                                            Assinatura do Motorista: ___________________________________________
                                        </p>
                                    </div>
                                </div>
                            </PageWrapper>
                        </div>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};
