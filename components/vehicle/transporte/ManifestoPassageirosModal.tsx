import React, { useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Printer, FileText, Download, Users, CheckCircle2, ShieldCheck, MapPin, Calendar, Clock, Car, User } from 'lucide-react';
import { VehicleSchedule, Vehicle, Person, CrewMember } from '../../../types';

interface ManifestoPassageirosModalProps {
  isOpen: boolean;
  onClose: () => void;
  schedule: VehicleSchedule;
  vehicle?: Vehicle;
  driver?: Person;
}

export const ManifestoPassageirosModal: React.FC<ManifestoPassageirosModalProps> = ({
  isOpen,
  onClose,
  schedule,
  vehicle,
  driver
}) => {
  const printAreaRef = useRef<HTMLDivElement | null>(null);

  if (!isOpen || !schedule) return null;

  const passengers = schedule.passengers || [];
  const departureDate = new Date(schedule.departureDateTime).toLocaleDateString('pt-BR');
  const departureTime = new Date(schedule.departureDateTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const returnTime = new Date(schedule.returnDateTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const vehicleName = vehicle ? `${vehicle.brand} ${vehicle.model}` : (schedule as any).vehicleModel || 'Veículo Municipal';
  const vehiclePlate = vehicle ? vehicle.plate : (schedule as any).vehiclePlate || 'N/I';
  const driverName = driver ? driver.name : (schedule as any).driverName || 'Motorista a Definir';

  const handlePrint = () => {
    window.print();
  };

  return createPortal(
    <div className="fixed inset-0 z-[99999] bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 md:p-6 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl border border-slate-200 max-h-[94vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Barra Superior da Janela (não sai na impressão) */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-900 text-white flex items-center justify-between gap-4 shrink-0 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black tracking-tight uppercase">
                Manifesto de Passageiros • Transporte de Pacientes
              </h3>
              <p className="text-xs text-slate-400 font-medium">
                Protocolo: <span className="font-mono text-indigo-300 font-bold">{schedule.protocol || schedule.id}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir / Salvar PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Documento Oficial Formatado para Leitura e Impressão */}
        <div className="flex-1 overflow-y-auto p-6 md:p-10 custom-scrollbar bg-slate-100/50 print:bg-white print:p-0 print:overflow-visible">
          <div 
            ref={printAreaRef}
            className="max-w-[210mm] mx-auto bg-white p-8 md:p-12 rounded-2xl shadow-sm border border-slate-200 print:border-none print:shadow-none print:p-4 text-slate-900 space-y-6"
          >
            {/* Cabeçalho Oficial */}
            <div className="text-center border-b-2 border-slate-800 pb-5 space-y-1">
              <div className="flex items-center justify-center gap-2 mb-1">
                <span className="text-2xl font-black text-slate-900 tracking-wider">PREFEITURA MUNICIPAL DE SÃO JOSÉ DO GOIABAL</span>
              </div>
              <p className="text-xs font-black uppercase tracking-widest text-slate-600">
                ESTADO DE MINAS GERAIS • SECRETARIA MUNICIPAL DE SAÚDE
              </p>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                CENTRAL DE TRANSPORTE DE PACIENTES E GESTÃO DE FROTAS
              </p>
              <div className="pt-2">
                <span className="inline-block px-4 py-1 rounded-md bg-slate-900 text-white text-xs font-black uppercase tracking-widest">
                  MANIFESTO OFICIAL DE PASSAGEIROS
                </span>
              </div>
            </div>

            {/* Metadados da Viagem */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
              <div>
                <span className="text-[10px] font-black uppercase text-slate-500 block">Destino:</span>
                <span className="font-black text-slate-900 uppercase text-sm">{schedule.destination}</span>
              </div>
              <div>
                <span className="text-[10px] font-black uppercase text-slate-500 block">Data da Viagem:</span>
                <span className="font-bold text-slate-900">{departureDate}</span>
              </div>
              <div>
                <span className="text-[10px] font-black uppercase text-slate-500 block">Horário de Saída:</span>
                <span className="font-bold text-slate-900">{departureTime} (Retorno: {returnTime})</span>
              </div>
              <div>
                <span className="text-[10px] font-black uppercase text-slate-500 block">Veículo / Placa:</span>
                <span className="font-bold text-slate-900 uppercase">{vehicleName} • <span className="font-mono font-black">{vehiclePlate}</span></span>
              </div>
              <div className="col-span-2">
                <span className="text-[10px] font-black uppercase text-slate-500 block">Motorista Responsável:</span>
                <span className="font-black text-slate-900 uppercase">{driverName}</span>
              </div>
              <div className="col-span-2">
                <span className="text-[10px] font-black uppercase text-slate-500 block">Ocupação / Assentos:</span>
                <span className="font-bold text-slate-900">
                  {passengers.length} passageiro(s) registrado(s) (+ 1 motorista)
                </span>
              </div>
            </div>

            {/* Relação de Passageiros Confirmados */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-1">
                <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">
                  Relação de Passageiros e Acompanhantes Autorizados ({passengers.length})
                </h4>
                <span className="text-[10px] font-bold text-slate-400">
                  Embarque exclusivo mediante confirmação prévia
                </span>
              </div>

              {passengers.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400 border border-dashed border-slate-300 rounded-xl">
                  Nenhum passageiro alocado nesta viagem até o momento.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border border-slate-200 rounded-xl overflow-hidden">
                    <thead className="bg-slate-100 text-slate-700 uppercase font-black text-[10px] tracking-wider border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3 w-10 text-center">#</th>
                        <th className="py-2.5 px-3">Nome Completo</th>
                        <th className="py-2.5 px-3">Categoria</th>
                        <th className="py-2.5 px-3">Documento (CPF)</th>
                        <th className="py-2.5 px-3">Telefone</th>
                        <th className="py-2.5 px-3">Procedimento / Obs</th>
                        <th className="py-2.5 px-3 w-36 text-center">Assinatura no Embarque</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {passengers.map((pax, idx) => (
                        <tr key={pax.id || idx} className="hover:bg-slate-50">
                          <td className="py-2 px-3 text-center font-bold text-slate-400">{idx + 1}</td>
                          <td className="py-2 px-3 font-black text-slate-900 uppercase">
                            {pax.name}
                          </td>
                          <td className="py-2 px-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                              pax.type === 'Paciente' ? 'bg-indigo-100 text-indigo-900' : 'bg-slate-100 text-slate-700'
                            }`}>
                              {pax.type || 'Paciente'}
                            </span>
                          </td>
                          <td className="py-2 px-3 font-mono text-slate-600">
                            {pax.cpf ? pax.cpf.replace(/(\d{3})\d{3}\d{3}(\d{2})/, '$1.***.***-$2') : '---'}
                          </td>
                          <td className="py-2 px-3 text-slate-600 font-mono">
                            {pax.phone || '---'}
                          </td>
                          <td className="py-2 px-3 text-slate-600">
                            <span className="font-semibold block">{pax.procedureName || pax.notes || 'Consulta/Exame'}</span>
                            {pax.appointmentTime && (
                              <span className="text-[10px] text-slate-400 block">Horário: {pax.appointmentTime}</span>
                            )}
                          </td>
                          <td className="py-2 px-3 border-l border-slate-200 text-center">
                            <div className="h-6 border-b border-dashed border-slate-300 w-full" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Informações Operacionais e Normas de Embarque */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 space-y-1">
              <span className="font-black text-slate-800 uppercase block">Instruções de Embarque:</span>
              <ul className="list-disc list-inside space-y-0.5 text-[10px]">
                <li>Apresentar documento de identificação com foto no momento do embarque.</li>
                <li>Comparecer ao ponto de embarque com antecedência mínima de 15 minutos do horário estipulado.</li>
                <li>É obrigatório o uso do cinto de segurança durante todo o trajeto da viagem.</li>
                <li>Este manifesto é de uso estritamente operacional da Secretaria Municipal de Saúde. Preservação de sigilo médico conforme Lei 13.709/2018 (LGPD).</li>
              </ul>
            </div>

            {/* Assinaturas */}
            <div className="pt-8 grid grid-cols-2 gap-8 text-center text-xs">
              <div>
                <div className="border-t border-slate-800 w-3/4 mx-auto pt-1 font-black uppercase text-slate-900">
                  {driverName}
                </div>
                <span className="text-[10px] font-bold text-slate-500 uppercase">Motorista Oficial</span>
              </div>
              <div>
                <div className="border-t border-slate-800 w-3/4 mx-auto pt-1 font-black uppercase text-slate-900">
                  Responsável pelo Transporte
                </div>
                <span className="text-[10px] font-bold text-slate-500 uppercase">Secretaria Municipal de Saúde</span>
              </div>
            </div>

            {/* Rodapé com timestamp */}
            <div className="border-t border-slate-200 pt-3 text-center text-[9px] text-slate-400 font-mono">
              Documento emitido pelo Sistema Integrado de Saúde em {new Date().toLocaleString('pt-BR')} • Protocolo: {schedule.protocol || schedule.id}
            </div>
          </div>
        </div>

      </div>
    </div>,
    document.body
  );
};
