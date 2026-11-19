import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  CheckCircle2, 
  Copy, 
  Check, 
  FileDown, 
  Eye, 
  X, 
  Car, 
  User, 
  MapPin, 
  Calendar, 
  Clock, 
  Target, 
  Building2, 
  Users, 
  Printer, 
  Loader2, 
  ShieldCheck,
  CheckCircle,
  Clock4
} from 'lucide-react';
import { VehicleSchedule, Vehicle, Person, Sector, AppState } from '../../types';
import { PageWrapper } from '../PageWrapper';
import { maskCpfPartial, formatBirthDateBr } from '../../utils/cpfUtils';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

interface AgendamentoConfirmadoModalProps {
  isOpen: boolean;
  schedule: VehicleSchedule | null;
  vehicles: Vehicle[];
  persons: Person[];
  sectors: Sector[];
  state: AppState;
  currentUserName?: string;
  onClose: () => void;
  onViewInHistory: () => void;
}

export const AgendamentoConfirmadoModal: React.FC<AgendamentoConfirmadoModalProps> = ({
  isOpen,
  schedule,
  vehicles,
  persons,
  sectors,
  state,
  currentUserName,
  onClose,
  onViewInHistory
}) => {
  const [copiedProtocol, setCopiedProtocol] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfProgress, setPdfProgress] = useState<{ current: number; total: number } | null>(null);
  const [pdfErrorMessage, setPdfErrorMessage] = useState<string | null>(null);

  if (!isOpen || !schedule) return null;

  // Resolução de Entidades Reais
  const vehicle = vehicles.find(v => v.id === schedule.vehicleId);
  const driver = persons.find(p => p.id === schedule.driverId);
  const requester = persons.find(p => p.id === schedule.requesterPersonId);
  const sector = sectors.find(s => s.id === schedule.serviceSectorId);

  // Formatação de Datas e Horários
  const formatDateTimeBr = (dateStr?: string | null) => {
    if (!dateStr) return 'Não informado';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  const formatDateBr = (dateStr?: string | null) => {
    if (!dateStr) return 'Não informado';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  const formatTimeBr = (dateStr?: string | null) => {
    if (!dateStr) return '00:00';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  // Contadores Reais da Tripulação
  const passengersList = schedule.passengers || [];
  const countPacientes = passengersList.filter(p => p.type === 'paciente' || (!p.type && !p.companionForPatientId)).length;
  const countAcompanhantes = passengersList.filter(p => p.type === 'acompanhante' || Boolean(p.companionForPatientId)).length;

  const handleCopyProtocol = () => {
    if (!schedule.protocol) return;
    navigator.clipboard.writeText(schedule.protocol);
    setCopiedProtocol(true);
    setTimeout(() => setCopiedProtocol(false), 2500);
  };

  // Geração de Comprovante em PDF
  const handleDownloadPdf = async () => {
    setIsGeneratingPdf(true);
    setPdfErrorMessage(null);
    setPdfProgress({ current: 1, total: 1 });

    // Permite que o container do PDF renderize com fontes e imagens prontas
    await new Promise(resolve => setTimeout(resolve, 600));

    try {
      const container = document.getElementById('comprovante-pdf-print-root');
      if (!container) {
        throw new Error('Container do comprovante não encontrado para geração do PDF.');
      }

      const pageElements = container.querySelectorAll<HTMLElement>('.pdf-document-page');
      const totalPages = pageElements.length || 1;

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      for (let i = 0; i < totalPages; i++) {
        setPdfProgress({ current: i + 1, total: totalPages });
        const targetPage = pageElements[i] || container;

        const canvas = await html2canvas(targetPage, {
          scale: 2,
          useCORS: true,
          logging: false,
          scrollY: 0,
          scrollX: 0,
          backgroundColor: '#ffffff'
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.98);
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

        if (i > 0) {
          pdf.addPage();
        }

        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      }

      // Nome obrigatório: Comprovante_Agendamento_OS-XXXX.pdf
      const rawProtocol = (schedule.protocol || 'OS-GERADA').trim();
      const sanitizedProtocol = rawProtocol.startsWith('OS-') ? rawProtocol : `OS-${rawProtocol}`;
      const fileName = `Comprovante_Agendamento_${sanitizedProtocol}.pdf`;

      pdf.save(fileName);
    } catch (err: any) {
      console.error('Erro ao gerar comprovante PDF do agendamento:', err);
      setPdfErrorMessage('Não foi possível concluir o download do PDF no momento. Seu agendamento permanece salvo e seguro.');
    } finally {
      setIsGeneratingPdf(false);
      setPdfProgress(null);
    }
  };

  // Preparação de Estado Sintético para PageWrapper Institucional
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
      title: 'ORDEM DE TRÁFEGO / COMPROVANTE DE AGENDAMENTO',
      protocol: schedule.protocol,
      signatureSector: sector?.name || 'Setor Municipal de Transportes'
    }
  };

  const statusIsConfirmed = schedule.status === 'confirmado';

  const modalNode = (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-200">
      
      {/* Container Principal do Modal */}
      <div 
        className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-agendamento-sucesso-title"
      >
        
        {/* 1. Cabeçalho Verde de Confirmação em Destaque */}
        <div className="px-6 py-5 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white flex items-center justify-between shrink-0 shadow-md">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-white/20 border border-white/25 flex items-center justify-center text-white shadow-inner shrink-0">
              <CheckCircle2 className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <h2 id="modal-agendamento-sucesso-title" className="text-base sm:text-lg font-black tracking-tight uppercase leading-none">
                Agendamento Realizado com Sucesso!
              </h2>
              <p className="text-xs text-emerald-100 font-medium mt-1 leading-tight">
                Seu agendamento foi registrado e está disponível no histórico de veículos.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            title="Fechar e Retornar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 2. Conteúdo com Scroll Interno Limpo */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4.5 flex-1 custom-scrollbar text-xs bg-slate-50/50">

          {/* Alerta de erro de PDF caso ocorra (sem alert nativo) */}
          {pdfErrorMessage && (
            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 font-bold flex items-center justify-between gap-2 animate-in fade-in">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
                <span>{pdfErrorMessage}</span>
              </div>
              <button
                type="button"
                onClick={handleDownloadPdf}
                className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white text-[10px] uppercase font-black rounded-lg cursor-pointer shrink-0"
              >
                Tentar Novamente
              </button>
            </div>
          )}

          {/* Card Principal: Protocolo da OS e Status Inicial */}
          <div className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                Número da OS / Protocolo
              </span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-base font-black text-slate-900 tracking-wide bg-slate-100 px-3 py-1 rounded-xl border border-slate-200">
                  {schedule.protocol}
                </span>
                <button
                  type="button"
                  onClick={handleCopyProtocol}
                  className="px-2.5 py-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer border border-slate-200 hover:border-indigo-200"
                  title="Copiar número do protocolo"
                >
                  {copiedProtocol ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                      <span className="text-emerald-700 font-black">Copiado</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Status Inicial:
              </span>
              <span className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider inline-flex items-center gap-1.5 shadow-2xs ${
                statusIsConfirmed 
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                  : 'bg-amber-50 text-amber-800 border border-amber-200'
              }`}>
                {statusIsConfirmed ? (
                  <>
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Confirmado</span>
                  </>
                ) : (
                  <>
                    <Clock4 className="w-3.5 h-3.5 text-amber-600" />
                    <span>Aguardando Aprovação</span>
                  </>
                )}
              </span>
            </div>
          </div>

          {/* Grid de Informações Chave da Viagem */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            
            {/* Veículo e Placa */}
            <div className="p-3.5 bg-white rounded-2xl border border-slate-200/90 shadow-2xs space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Car className="w-3.5 h-3.5 text-indigo-500" /> Veículo e Placa
              </span>
              <p className="text-xs font-black text-slate-900 uppercase">
                {vehicle ? `${vehicle.type} — ${vehicle.model}` : 'Veículo não identificado'}
              </p>
              <div className="flex items-center gap-2 text-[11px] text-slate-600 font-bold">
                <span className="font-mono bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-slate-800">
                  {vehicle?.plate || '---'}
                </span>
                <span>• Capacidade: {vehicle?.passengerCapacity ? `${vehicle.passengerCapacity} lugares` : '---'}</span>
              </div>
            </div>

            {/* Motorista Responsável */}
            <div className="p-3.5 bg-white rounded-2xl border border-slate-200/90 shadow-2xs space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-indigo-500" /> Motorista Responsável
              </span>
              <p className="text-xs font-black text-slate-900 uppercase">
                {driver?.name || 'Condutor Autorizado'}
              </p>
              <p className="text-[11px] text-slate-500 font-semibold">
                {driver?.jobId ? 'Motorista Oficial Municipal' : 'Condutor Credenciado'}
              </p>
            </div>

            {/* Município de Destino */}
            <div className="p-3.5 bg-white rounded-2xl border border-slate-200/90 shadow-2xs space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-rose-500" /> Município de Destino
              </span>
              <p className="text-xs font-black text-slate-900 uppercase">
                {schedule.destination || 'Não informado'}
              </p>
              {schedule.vehicleLocation && (
                <p className="text-[11px] text-slate-500 font-medium truncate">
                  Saída de: {schedule.vehicleLocation}
                </p>
              )}
            </div>

            {/* Solicitante e Setor */}
            <div className="p-3.5 bg-white rounded-2xl border border-slate-200/90 shadow-2xs space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-indigo-500" /> Solicitante e Setor
              </span>
              <p className="text-xs font-black text-slate-900 uppercase truncate">
                {requester?.name || currentUserName || 'Solicitante Municipal'}
              </p>
              <p className="text-[11px] text-slate-500 font-semibold truncate">
                {sector?.name || 'Secretaria Municipal de Saúde'}
              </p>
            </div>

            {/* Cronograma: Saída e Retorno */}
            <div className="sm:col-span-2 p-3.5 bg-white rounded-2xl border border-slate-200/90 shadow-2xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-emerald-600" /> Data e Horário de Saída
                  </span>
                  <p className="text-xs font-black text-slate-800">
                    {formatDateTimeBr(schedule.departureDateTime)}
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-indigo-600" /> Data e Horário de Retorno
                  </span>
                  <p className="text-xs font-black text-slate-800">
                    {formatDateTimeBr(schedule.returnDateTime)}
                  </p>
                </div>
              </div>
            </div>

            {/* Objetivo da Viagem */}
            <div className="sm:col-span-2 p-3.5 bg-white rounded-2xl border border-slate-200/90 shadow-2xs space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-amber-500" /> Objetivo da Viagem
              </span>
              <p className="text-xs font-semibold text-slate-700 leading-relaxed">
                {schedule.purpose || 'Transporte e atendimento municipal de saúde.'}
              </p>
            </div>
          </div>

          {/* Seção da Tripulação e Ocupação */}
          <div className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-600" />
                <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                  Lista de Passageiros Vinculados ({passengersList.length})
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px] font-bold">
                <span className="px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-700">
                  {countPacientes} {countPacientes === 1 ? 'Paciente' : 'Pacientes'}
                </span>
                <span className="px-2 py-0.5 rounded-lg bg-purple-50 text-purple-700">
                  {countAcompanhantes} {countAcompanhantes === 1 ? 'Acompanhante' : 'Acompanhantes'}
                </span>
              </div>
            </div>

            {/* Tabela Limpa de Passageiros */}
            {passengersList.length > 0 ? (
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="max-h-48 overflow-y-auto custom-scrollbar">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-500 sticky top-0">
                      <tr>
                        <th className="py-2 px-3">Passageiro</th>
                        <th className="py-2 px-2">Horário</th>
                        <th className="py-2 px-2">Local de embarque</th>
                        <th className="py-2 px-2">Ponto de destino</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs font-medium">
                      {passengersList.map((p, idx) => {
                        const isAcomp = p.type === 'acompanhante' || Boolean(p.companionForPatientId);
                        return (
                          <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-2 px-3 font-bold text-slate-900 uppercase">
                              <span className="block truncate max-w-[200px]">{p.name}</span>
                              {p.nickname && <span className="text-[10px] text-indigo-600 block font-normal">Apelido: {p.nickname}</span>}
                              {isAcomp && (
                                <span className="text-[10px] text-purple-700 block font-normal">
                                  Acompanhante {p.companionForPatientName ? `• Acomp.: ${p.companionForPatientName}` : ''}
                                </span>
                              )}
                              {!isAcomp && p.companionName && (
                                <span className="text-[10px] text-slate-500 block font-normal">Acompanhante: {p.companionName}</span>
                              )}
                            </td>
                            <td className="py-2 px-2 font-mono text-[11px] font-bold text-indigo-700 whitespace-nowrap">
                              {p.departureTime || p.appointmentTime || '---'}
                            </td>
                            <td className="py-2 px-2 text-slate-600 text-[11px] truncate max-w-[160px]" title={p.departureLocation || 'Ponto Central'}>
                              {p.departureLocation || 'Ponto Central'}
                            </td>
                            <td className="py-2 px-2 text-slate-700 text-[11px] font-semibold truncate max-w-[180px]" title={p.destinationPoint || p.appointmentLocation || schedule.destination || '---'}>
                              {p.destinationPoint || p.appointmentLocation || schedule.destination || '---'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <p className="text-slate-400 font-bold text-center py-3 bg-slate-50 rounded-xl">
                Nenhum passageiro adicionado nesta viagem.
              </p>
            )}
          </div>

        </div>

        {/* 3. Rodapé com os Três Botões de Ação Exigidos */}
        <div className="p-4 sm:p-5 border-t border-slate-100 bg-white flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          
          {/* Botão Principal: BAIXAR COMPROVANTE PDF */}
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isGeneratingPdf}
            className="w-full sm:w-auto px-5 py-3 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md shadow-emerald-600/25 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isGeneratingPdf ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Gerando PDF...</span>
              </>
            ) : (
              <>
                <FileDown className="w-4 h-4" />
                <span>📄 Baixar Comprovante PDF</span>
              </>
            )}
          </button>

          {/* Botões Secundários: VER AGENDAMENTO e CONCLUIR */}
          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={onViewInHistory}
              disabled={isGeneratingPdf}
              className="flex-1 sm:flex-none px-4 py-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-black text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 border border-indigo-200/80"
            >
              <Eye className="w-4 h-4" />
              <span>Ver Agendamento</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              disabled={isGeneratingPdf}
              className="flex-1 sm:flex-none px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer active:scale-95"
            >
              Concluir
            </button>
          </div>
        </div>

      </div>

      {/* 4. Overlay de Progresso da Geração de PDF (Padrão Oficial do Sistema) */}
      {isGeneratingPdf && pdfProgress && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm pointer-events-none">
          <div className="bg-white p-7 sm:p-8 rounded-3xl flex flex-col items-center max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <Printer className="w-12 h-12 text-emerald-600 mb-4 animate-pulse" />
            <h3 className="text-base sm:text-lg font-black text-slate-900 mb-1 tracking-tight uppercase">
              Gerando PDF...
            </h3>
            <p className="text-xs font-bold text-slate-500 mb-5">
              Página {pdfProgress.current} de {pdfProgress.total}
            </p>
            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-600 rounded-full transition-all duration-300"
                style={{ width: `${Math.max(10, (pdfProgress.current / pdfProgress.total) * 100)}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-400 mt-4 text-center font-medium">
              Preparando o documento para download. Aguarde um instante.
            </p>
          </div>
        </div>
      )}

      {/* 5. Container de Impressão Renderizado Fora do Fluxo de Tela (A4 Institucional) */}
      <div 
        id="comprovante-pdf-print-root" 
        style={{ position: 'fixed', left: '-9999px', top: 0, width: '210mm' }}
        aria-hidden="true"
      >
        <div className="pdf-document-page">
          <PageWrapper state={previewState} pageIndex={0} totalPages={1} isGenerating={true}>
            <div className="flex flex-col gap-3 text-slate-900 font-sans">
              
              {/* Título do Documento e Protocolo */}
              <div className="border-b-2 border-slate-900 pb-2 flex items-center justify-between">
                <div>
                  <h1 className="text-[14pt] font-black uppercase tracking-tight text-slate-900">
                    Comprovante de Agendamento de Veículo
                  </h1>
                  <p className="text-[8pt] text-slate-500 font-bold uppercase tracking-wider">
                    Ordem de Tráfego e Transporte Municipal • Secretaria de Administração e Finanças
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[7pt] font-black uppercase tracking-widest text-slate-400 block">Número da OS</span>
                  <span className="font-mono text-[12pt] font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-300">
                    {schedule.protocol}
                  </span>
                </div>
              </div>

              {/* Status e Auditoria */}
              <div className="grid grid-cols-2 gap-2 text-[8pt] bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <div>
                  <span className="font-bold text-slate-500 uppercase text-[6.5pt] block">Status do Registro:</span>
                  <span className="font-black uppercase text-emerald-800 text-[8.5pt]">
                    {statusIsConfirmed ? 'Agendamento Confirmado' : 'Aguardando Aprovação'}
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-bold text-slate-500 uppercase text-[6.5pt] block">Data e Hora de Emissão:</span>
                  <span className="font-bold text-slate-800 text-[8pt]">
                    {new Date().toLocaleString('pt-BR')}
                  </span>
                </div>
              </div>

              {/* Informações do Veículo e Motorista */}
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 border border-slate-200 rounded-lg bg-white">
                  <span className="text-[6.5pt] font-black uppercase tracking-widest text-slate-400 block mb-1">
                    Veículo Vinculado
                  </span>
                  <p className="text-[10pt] font-black text-slate-900 uppercase">
                    {vehicle?.model || 'Não informado'}
                  </p>
                  <p className="text-[7.5pt] text-slate-600 font-bold mt-0.5">
                    Placa: <span className="font-mono">{vehicle?.plate || '---'}</span> • Tipo: {vehicle?.type?.toUpperCase() || 'CARRO'}
                  </p>
                  <p className="text-[7pt] text-slate-500">
                    Capacidade: {vehicle?.passengerCapacity || '---'} lugares
                  </p>
                </div>

                <div className="p-2.5 border border-slate-200 rounded-lg bg-white">
                  <span className="text-[6.5pt] font-black uppercase tracking-widest text-slate-400 block mb-1">
                    Motorista Responsável
                  </span>
                  <p className="text-[10pt] font-black text-slate-900 uppercase">
                    {driver?.name || 'Condutor Autorizado'}
                  </p>
                  <p className="text-[7.5pt] text-slate-600 font-bold mt-0.5">
                    {driver?.jobId ? 'Motorista Oficial Municipal' : 'Condutor Credenciado'}
                  </p>
                  {driver?.phone && (
                    <p className="text-[7pt] text-slate-500">Contato: {driver.phone}</p>
                  )}
                </div>
              </div>

              {/* Solicitante, Setor e Destino */}
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 border border-slate-200 rounded-lg bg-white">
                  <span className="text-[6.5pt] font-black uppercase tracking-widest text-slate-400 block mb-1">
                    Solicitante & Setor
                  </span>
                  <p className="text-[9pt] font-bold text-slate-800 uppercase">
                    {requester?.name || currentUserName || '---'}
                  </p>
                  <p className="text-[7.5pt] text-slate-500 font-medium">
                    {sector?.name || 'Secretaria Municipal de Saúde'}
                  </p>
                </div>

                <div className="p-2.5 border border-slate-200 rounded-lg bg-white">
                  <span className="text-[6.5pt] font-black uppercase tracking-widest text-slate-400 block mb-1">
                    Destino da Viagem
                  </span>
                  <p className="text-[10pt] font-black text-slate-900 uppercase">
                    {schedule.destination || 'Não informado'}
                  </p>
                  {schedule.vehicleLocation && (
                    <p className="text-[7pt] text-slate-500 truncate">Saída: {schedule.vehicleLocation}</p>
                  )}
                </div>
              </div>

              {/* Cronograma da Viagem */}
              <div className="p-2.5 border border-slate-200 rounded-lg bg-slate-50 grid grid-cols-2 gap-2 text-[8pt]">
                <div>
                  <span className="text-[6.5pt] font-black uppercase tracking-widest text-slate-400 block">Saída Prevista</span>
                  <span className="font-bold text-slate-800 text-[8.5pt]">
                    {formatDateBr(schedule.departureDateTime)} às {formatTimeBr(schedule.departureDateTime)}
                  </span>
                </div>
                <div>
                  <span className="text-[6.5pt] font-black uppercase tracking-widest text-slate-400 block">Retorno Previsto</span>
                  <span className="font-bold text-slate-800 text-[8.5pt]">
                    {formatDateBr(schedule.returnDateTime)} às {formatTimeBr(schedule.returnDateTime)}
                  </span>
                </div>
              </div>

              {/* Objetivo da Viagem */}
              <div className="p-2.5 border border-slate-200 rounded-lg bg-white">
                <span className="text-[6.5pt] font-black uppercase tracking-widest text-slate-400 block mb-0.5">
                  Finalidade / Objetivo
                </span>
                <p className="text-[8pt] text-slate-700 font-medium leading-relaxed">
                  {schedule.purpose || 'Transporte de pacientes e servidores para atendimento municipal.'}
                </p>
              </div>

              {/* Relação de Passageiros / Tripulação */}
              <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                <div className="bg-slate-100 px-3 py-1.5 border-b border-slate-200 flex items-center justify-between">
                  <span className="text-[7.5pt] font-black uppercase tracking-wider text-slate-700">
                    Tripulação ({passengersList.length})
                  </span>
                  <span className="text-[6.5pt] font-bold text-slate-500 uppercase">
                    {countPacientes} Paciente(s) • {countAcompanhantes} Acompanhante(s)
                  </span>
                </div>
                <table className="w-full table-fixed text-left border-collapse text-[7pt]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[6.5pt] font-black uppercase tracking-wider text-slate-500">
                      <th className="py-1.5 px-2 w-[32%]">Passageiro</th>
                      <th className="py-1.5 px-2 w-[14%] text-center">Horário</th>
                      <th className="py-1.5 px-2 w-[27%]">Local de embarque</th>
                      <th className="py-1.5 px-2 w-[27%]">Ponto de destino</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {passengersList.map((p, idx) => {
                      const isAcomp = p.type === 'acompanhante' || Boolean(p.companionForPatientId);
                      return (
                        <tr key={idx} className={isAcomp ? 'bg-purple-50/25' : ''}>
                          <td className="py-1.5 px-2 font-bold text-slate-900 uppercase break-words align-top">
                            <div className="flex items-start gap-1">
                              <span className="text-slate-400 font-mono text-[6pt] shrink-0">{idx + 1}.</span>
                              <div className="min-w-0">
                                <span>{p.name}</span>
                                {p.nickname && <span className="text-[6pt] text-indigo-700 block font-normal lowercase">({p.nickname})</span>}
                                {isAcomp ? (
                                  <span className="inline-block mt-0.5 px-1 py-0.2 bg-purple-100 text-purple-900 text-[5.5pt] font-black uppercase rounded">
                                    Acompanhante {p.companionForPatientName ? `• de ${p.companionForPatientName}` : ''}
                                  </span>
                                ) : p.companionName ? (
                                  <span className="text-[5.5pt] text-slate-500 font-bold block uppercase mt-0.5">
                                    Acompanhante: {p.companionName}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          </td>
                          <td className="py-1.5 px-2 font-mono font-bold text-slate-900 text-center whitespace-nowrap align-top">
                            {p.departureTime || p.appointmentTime || '---'}
                          </td>
                          <td className="py-1.5 px-2 text-slate-700 break-words whitespace-normal align-top">
                            {p.departureLocation || 'Ponto Central'}
                          </td>
                          <td className="py-1.5 px-2 text-slate-800 font-semibold break-words whitespace-normal align-top">
                            {p.destinationPoint || p.appointmentLocation || schedule.destination || '---'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Assinaturas Institucionais */}
              <div className="pt-8 mt-2 border-t border-slate-300 grid grid-cols-2 gap-8 text-center">
                <div>
                  <div className="border-b border-slate-500 w-48 mx-auto mb-1"></div>
                  <p className="text-[7.5pt] font-black uppercase text-slate-800">{driver?.name || 'Condutor Responsável'}</p>
                  <p className="text-[6.5pt] text-slate-500 uppercase">Assinatura do Motorista</p>
                </div>
                <div>
                  <div className="border-b border-slate-500 w-48 mx-auto mb-1"></div>
                  <p className="text-[7.5pt] font-black uppercase text-slate-800">{sector?.name || 'Setor de Transportes'}</p>
                  <p className="text-[6.5pt] text-slate-500 uppercase">Visto do Responsável / Frota</p>
                </div>
              </div>

            </div>
          </PageWrapper>
        </div>
      </div>

    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalNode, document.body) : modalNode;
};
