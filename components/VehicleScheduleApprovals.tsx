
import React, { useState } from 'react';
import { ShieldCheck, Car, User, MapPin, Clock, CheckCircle2, XCircle, AlertCircle, Calendar, ArrowLeft, Lock, Info, Target, FileText, ChevronDown, Check, Building2, Activity, Navigation, X, Search } from 'lucide-react';
import { Vehicle, Person, VehicleSchedule, Sector, AppState } from '../types';
import { VehicleServiceOrderPreview } from './VehicleServiceOrderPreview';

interface VehicleScheduleApprovalsProps {
  schedules: VehicleSchedule[];
  vehicles: Vehicle[];
  persons: Person[];
  sectors: Sector[];
  onApprove: (s: VehicleSchedule) => void;
  onReject: (s: VehicleSchedule) => void;
  onBack?: () => void;
  currentUserId: string;
  currentUserRole: string;
  currentUserPersonId?: string;
  state: AppState;
}

export const VehicleScheduleApprovals: React.FC<VehicleScheduleApprovalsProps> = ({
  schedules,
  vehicles,
  persons,
  sectors,
  onApprove,
  onReject,
  onBack,
  currentUserId,
  currentUserRole,
  currentUserPersonId,
  state
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [viewingPurpose, setViewingPurpose] = useState<VehicleSchedule | null>(null);
  const [previewingOS, setPreviewingOS] = useState<VehicleSchedule | null>(null);

  const filteredPending = (schedules || [])
    .filter(s => s.status === 'pendente')
    .filter(s => {
      const v = vehicles.find(veh => veh.id === s.vehicleId);
      const d = persons.find(p => p.id === s.driverId);
      const searchLower = searchTerm.toLowerCase();
      return (
        s.protocol.toLowerCase().includes(searchLower) ||
        (v?.model || '').toLowerCase().includes(searchLower) ||
        (v?.plate || '').toLowerCase().includes(searchLower) ||
        (d?.name || '').toLowerCase().includes(searchLower) ||
        s.destination.toLowerCase().includes(searchLower)
      );
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <div className="flex-1 flex flex-col overflow-hidden animate-fade-in bg-slate-50">
      {/* Header Desktop (Web) */}
      <div className="hidden md:flex bg-white border-b border-slate-100 px-6 py-4 items-center justify-between gap-4 shrink-0 shadow-sm relative z-20">
        <div className="flex items-center gap-4">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all group"
              title="Voltar ao Menu"
            >
              <ArrowLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
            </button>
          )}

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-600/20 shrink-0">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight leading-none">
                Atendimento de Pedidos
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100 uppercase tracking-widest">
                  {filteredPending.length} Pendentes
                </span>
              </div>
            </div>
          </div>

          <div className="relative w-64 group ml-2">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all shadow-inner"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          </div>
        </div>
      </div>

      {/* Header Mobile Otimizado */}
      <div className="md:hidden bg-white border-b border-slate-100 px-3.5 py-3 shrink-0 shadow-xs relative z-20 space-y-2.5">
        {/* Linha 1: Voltar + Ícone + Título + Contador */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {onBack && (
              <button
                onClick={onBack}
                className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                title="Voltar ao Menu"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div className="w-8 h-8 bg-emerald-600 rounded-xl flex items-center justify-center shadow-md shadow-emerald-600/20 shrink-0 text-white">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-black text-slate-900 tracking-tight leading-none truncate">
                Atendimento de Pedidos
              </h2>
              <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-100 uppercase tracking-wider inline-block mt-0.5">
                {filteredPending.length} pendentes
              </span>
            </div>
          </div>
        </div>

        {/* Linha 2: Barra de Busca Mobile */}
        <div className="relative w-full">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar veículo, motorista, destino..."
            className="w-full pl-8 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-inner"
          />
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 md:p-8">
        <div className="max-w-6xl mx-auto w-full space-y-3.5 md:space-y-4 pb-8">
          {filteredPending.length > 0 ? (
            filteredPending.map(s => {
              const v = vehicles.find(veh => veh.id === s.vehicleId);
              const d = persons.find(p => p.id === s.driverId);
              const requesterPerson = persons.find(p => p.id === s.requesterPersonId);
              const sector = sectors.find(sec => sec.id === s.serviceSectorId)
                || (requesterPerson?.sectorId ? sectors.find(sec => sec.id === requesterPerson.sectorId) : undefined)
                || (v?.sectorId ? sectors.find(sec => sec.id === v.sectorId) : undefined);
              const canApprove = (currentUserRole === 'admin' || (currentUserPersonId && (v?.requestManagerIds?.includes(currentUserPersonId) || v?.responsiblePersonId === currentUserPersonId)));

              return (
                <React.Fragment key={s.id}>
                  {/* Card Desktop (Web Mantido Inalterado) */}
                  <div className="hidden md:flex bg-white p-4 rounded-[2rem] border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(16,185,129,0.15)] transition-all duration-300 hover:-translate-y-1 flex-col gap-3 group relative">
                    {/* Decorative Elements */}
                    <div className="absolute inset-0 rounded-[2rem] overflow-hidden pointer-events-none">
                      <div className="absolute top-0 right-0 p-6 opacity-0 group-hover:opacity-10 transition-opacity duration-500">
                        <Car className="w-24 h-24 text-emerald-900 transform rotate-12 translate-x-8 -translate-y-8" />
                      </div>
                    </div>

                    {/* Cabeçalho do Card */}
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 relative z-10">
                      {/* Lado Esquerdo: Veículo e Informações Principais */}
                      <div className="flex flex-col lg:flex-row gap-4 lg:items-center flex-1">
                        {/* Veículo Icon & Info */}
                        <div className="flex items-center gap-4 shrink-0">
                          <div className="w-12 h-12 bg-gradient-to-br from-emerald-50 to-slate-50 rounded-2xl flex items-center justify-center text-emerald-400 group-hover:text-emerald-600 group-hover:scale-110 transition-all duration-300 shadow-inner border border-white">
                            <Car className="w-5 h-5" />
                          </div>
                          <div className="flex flex-col gap-1 items-start">
                            <div className="flex items-center gap-2">
                              <h4 className="text-lg font-black text-slate-800 uppercase tracking-tight group-hover:text-emerald-700 transition-colors">{v?.model || 'Desconhecido'}</h4>
                              <div className="px-2 py-0.5 rounded-lg bg-emerald-600 text-white text-[9px] font-black uppercase tracking-wider shadow-sm">
                                ID: {s.protocol}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="inline-block font-mono text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200 uppercase tracking-wider">{v?.plate || '---'}</span>
                              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                <Clock className="w-2.5 h-2.5" /> Criado em: {new Date(s.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Divider Mobile/Desktop */}
                        <div className="hidden lg:block w-px h-10 bg-slate-100 mx-1"></div>

                        {/* Informações de Viagem (Datas e Destino) - Header */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 flex-1">
                          <div className="group/item flex flex-col gap-1.5">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Calendar className="w-3 h-3" /> Saída</p>
                            <div className="w-12 h-14 bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center shadow-sm shrink-0 group-hover/item:border-emerald-200 group-hover/item:shadow-emerald-500/10 transition-all p-1">
                              <span className="text-[7px] font-black text-slate-400 uppercase leading-none mb-0.5">
                                {new Date(s.departureDateTime).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}
                              </span>
                              <span className="text-lg font-black text-slate-700 leading-none group-hover/item:text-emerald-600 transition-colors mb-0.5">
                                {new Date(s.departureDateTime).getDate()}
                              </span>
                              <span className="text-[8px] font-bold text-slate-500 bg-slate-50 px-1 py-px rounded border border-slate-100">
                                {new Date(s.departureDateTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          </div>

                          <div className="group/item flex flex-col gap-1.5">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Calendar className="w-3 h-3" /> Retorno</p>
                            {s.returnDateTime ? (
                              <div className="w-12 h-14 bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center shadow-sm shrink-0 group-hover/item:border-emerald-200 group-hover/item:shadow-emerald-500/10 transition-all p-1">
                                <span className="text-[7px] font-black text-slate-400 uppercase leading-none mb-0.5">
                                  {new Date(s.returnDateTime).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}
                                </span>
                                <span className="text-lg font-black text-slate-700 leading-none group-hover/item:text-emerald-600 transition-colors mb-0.5">
                                  {new Date(s.returnDateTime).getDate()}
                                </span>
                                <span className="text-[8px] font-bold text-slate-500 bg-slate-50 px-1 py-px rounded border border-slate-100">
                                  {new Date(s.returnDateTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                            ) : (
                              <div className="w-12 h-14 bg-slate-50 rounded-xl border border-slate-100 flex flex-col items-center justify-center shrink-0">
                                <span className="text-[10px] font-black text-slate-300">--</span>
                              </div>
                            )}
                          </div>

                          {/* Botão Ver Motivo - No Header */}
                          <div className="flex items-center">
                            <button
                              onClick={() => setViewingPurpose(s)}
                              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-slate-500 text-[9px] font-bold uppercase tracking-wide rounded-xl hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all shadow-sm active:scale-95 flex items-center justify-center gap-2 group/btn"
                            >
                              <Target className="w-3.5 h-3.5 group-hover/btn:scale-110 transition-transform" /> Ver Motivo
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Lado Direito: AÇÕES DE APROVAÇÃO */}
                      <div className="flex items-center gap-2 shrink-0 lg:self-center self-start z-[5]">
                        <button onClick={() => setPreviewingOS(s)} className="px-3 py-2 bg-white border border-slate-200 text-slate-500 hover:bg-slate-900 hover:text-white hover:border-slate-900 rounded-lg transition-all active:scale-95 shadow-sm hover:shadow-md flex items-center gap-1.5 group/os">
                          <FileText className="w-3.5 h-3.5 group-hover/os:scale-110 transition-transform" />
                          <span className="text-[10px] font-black uppercase tracking-[0.1em]">OS</span>
                        </button>

                        {canApprove ? (
                          <>
                            <button
                              onClick={() => onReject(s)}
                              className="px-3 py-2 bg-white border border-rose-100 text-rose-500 hover:bg-rose-600 hover:text-white hover:border-rose-600 rounded-lg transition-all active:scale-95 shadow-sm hover:shadow-md flex items-center gap-1.5"
                              title="Rejeitar Solicitação"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => onApprove(s)}
                              className="px-4 py-2 bg-emerald-600 border border-emerald-600 text-white hover:bg-emerald-700 hover:border-emerald-700 rounded-lg transition-all active:scale-95 shadow-lg shadow-emerald-500/20 flex items-center gap-2 group/approve"
                            >
                              <CheckCircle2 className="w-4 h-4 group-hover/approve:scale-110 transition-transform" />
                              <span className="text-[10px] font-black uppercase tracking-widest">Aprovar</span>
                            </button>
                          </>
                        ) : (
                          <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg text-slate-400 select-none cursor-not-allowed">
                            <Lock className="w-3 h-3" />
                            <span className="text-[9px] font-black uppercase tracking-widest">Acesso Restrito</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Grid de Informações Secundárias */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-3 bg-slate-50/80 rounded-2xl border border-slate-100 relative z-0 transition-colors group-hover:bg-emerald-50/30 group-hover:border-emerald-100/50">
                      {/* Solicitante */}
                      <div className="space-y-0.5">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><User className="w-3 h-3" /> Solicitante</p>
                        <p className="text-[10px] font-bold text-slate-600 truncate" title={requesterPerson?.name}>{requesterPerson?.name || '---'}</p>
                      </div>

                      {/* Motorista */}
                      <div className="space-y-0.5">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><User className="w-3 h-3" /> Motorista</p>
                        <p className="text-[10px] font-bold text-slate-600 truncate" title={d?.name}>{d?.name || '---'}</p>
                      </div>

                      {/* Setor */}
                      <div className="space-y-0.5">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><Building2 className="w-3 h-3" /> Setor</p>
                        <p className="text-[10px] font-bold text-slate-600 truncate" title={sector?.name}>{sector?.name || '---'}</p>
                      </div>

                      {/* Destino */}
                      <div className="space-y-0.5">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><MapPin className="w-3 h-3 text-emerald-500" /> Destino</p>
                        <p className="text-[10px] font-black text-emerald-600 uppercase truncate" title={s.destination}>{s.destination}</p>
                      </div>
                    </div>
                  </div>

                  {/* Card Mobile Dedicado e Otimizado */}
                  <div className="md:hidden bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-3 relative overflow-hidden">
                    {/* Topo do Card: Veículo + Placa + Protocolo OS */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 shrink-0 font-bold border border-emerald-100">
                          <Car className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap leading-tight">
                            <h4 className="font-black text-slate-900 uppercase tracking-tight text-xs truncate">
                              {v?.model || 'Desconhecido'}
                            </h4>
                            <span className="px-1.5 py-0.5 bg-emerald-600 text-white text-[9px] font-black rounded-md uppercase tracking-wider shrink-0">
                              {s.protocol}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="font-mono text-[10px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 uppercase">
                              {v?.plate || '---'}
                            </span>
                            <span className="text-[8px] font-bold text-slate-400 uppercase flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5" /> {new Date(s.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}, {new Date(s.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Bloco de Horários: Saída e Retorno */}
                    <div className="grid grid-cols-2 gap-2 p-2.5 bg-slate-50/90 rounded-xl border border-slate-100 text-xs">
                      <div>
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Saída
                        </span>
                        <p className="text-[11px] font-bold text-slate-800 mt-0.5">
                          {new Date(s.departureDateTime).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <div>
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span> Retorno
                        </span>
                        <p className="text-[11px] font-bold text-slate-700 mt-0.5">
                          {s.returnDateTime ? new Date(s.returnDateTime).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '---'}
                        </p>
                      </div>
                    </div>

                    {/* Destino, Motorista, Solicitante & Setor */}
                    <div className="space-y-1.5 text-xs">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span className="text-[10px] font-black text-slate-400 uppercase">Destino:</span>
                        <span className="text-xs font-black text-emerald-700 uppercase truncate">{s.destination}</span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100 text-[11px]">
                        <div className="min-w-0">
                          <span className="text-[9px] font-black text-slate-400 uppercase block">Motorista:</span>
                          <span className="font-bold text-slate-700 truncate block">{d?.name || '---'}</span>
                        </div>
                        <div className="min-w-0">
                          <span className="text-[9px] font-black text-slate-400 uppercase block">Solicitante:</span>
                          <span className="font-bold text-slate-700 truncate block">{requesterPerson?.name || '---'}</span>
                          <span className="text-[9px] text-slate-400 font-semibold truncate block">{sector?.name || '---'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Botões de Ações e Aprovação */}
                    <div className="space-y-2 pt-1 border-t border-slate-100">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setViewingPurpose(s)}
                          className="flex-1 py-2 px-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-xl text-[10px] font-extrabold uppercase flex items-center justify-center gap-1.5 transition-all shadow-2xs"
                        >
                          <Target className="w-3.5 h-3.5 text-slate-500" />
                          <span>Ver Motivo</span>
                        </button>
                        <button
                          onClick={() => setPreviewingOS(s)}
                          className="py-2 px-3 bg-slate-900 hover:bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-1.5 transition-all shadow-2xs"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>OS</span>
                        </button>
                      </div>

                      {canApprove ? (
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <button
                            onClick={() => onReject(s)}
                            className="w-full py-2.5 px-3 bg-white hover:bg-rose-50 border border-rose-200 text-rose-600 rounded-xl font-black text-[11px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-2xs"
                          >
                            <XCircle className="w-4 h-4" />
                            <span>Rejeitar</span>
                          </button>
                          <button
                            onClick={() => onApprove(s)}
                            className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-[11px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-md shadow-emerald-600/20"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Aprovar</span>
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-50 border border-slate-100 rounded-xl text-slate-400 text-[10px] font-bold uppercase">
                          <Lock className="w-3.5 h-3.5" />
                          <span>Acesso Restrito</span>
                        </div>
                      )}
                    </div>
                  </div>
                </React.Fragment>
              );
            })
          ) : (
            <div className="py-20 md:py-24 text-center bg-white rounded-2xl md:rounded-[3rem] border border-dashed border-slate-200 flex flex-col items-center">
              <div className="w-20 md:w-24 h-20 md:h-24 bg-white rounded-2xl md:rounded-[2.5rem] shadow-xl flex items-center justify-center text-emerald-100 border border-emerald-50 mb-4 md:mb-6">
                <ShieldCheck className="w-10 md:w-14 h-10 md:h-14" />
              </div>
              <div>
                <p className="text-xl md:text-2xl font-black text-slate-900 uppercase tracking-tight">Fila Vazia</p>
                <p className="text-xs md:text-sm text-slate-400 font-medium">Nenhuma solicitação aguardando aprovação no momento.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Visualização do Objetivo */}
      {viewingPurpose && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg bg-white sm:rounded-[2.5rem] rounded-t-[2.5rem] shadow-2xl border border-white/20 overflow-hidden flex flex-col animate-slide-up h-full sm:h-auto max-h-[96vh]">
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-600/20">
                  <Target className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight uppercase">Objetivo da Viagem</h3>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Detalhes do Agendamento</p>
                </div>
              </div>
              <button onClick={() => setViewingPurpose(null)} className="p-3 hover:bg-white hover:shadow-md rounded-2xl text-slate-400 hover:text-slate-900 transition-all active:scale-90"><X className="w-6 h-6" /></button>
            </div>

            <div className="p-8 flex-1 overflow-y-auto custom-scrollbar">
              <div className="bg-slate-50 border border-slate-200 rounded-[2rem] p-6 relative">
                <p className="text-base text-slate-700 font-medium leading-relaxed">
                  "{viewingPurpose.purpose}"
                </p>
              </div>
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 shrink-0">
              <button onClick={() => setViewingPurpose(null)} className="w-full py-4 bg-slate-900 text-white font-black text-xs uppercase tracking-[0.2em] rounded-2xl shadow-xl hover:bg-indigo-600 transition-all">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Preview da OS */}
      {previewingOS && (
        <VehicleServiceOrderPreview
          schedule={previewingOS}
          vehicle={vehicles.find(v => v.id === previewingOS.vehicleId)!}
          driver={persons.find(p => p.id === previewingOS.driverId)!}
          requester={persons.find(p => p.id === previewingOS.requesterPersonId)}
          sector={
            sectors.find(s => s.id === previewingOS.serviceSectorId)
            || (persons.find(p => p.id === previewingOS.requesterPersonId)?.sectorId
                ? sectors.find(s => s.id === persons.find(p => p.id === previewingOS.requesterPersonId)?.sectorId)
                : undefined)
            || (vehicles.find(v => v.id === previewingOS.vehicleId)?.sectorId
                ? sectors.find(s => s.id === vehicles.find(v => v.id === previewingOS.vehicleId)?.sectorId)
                : undefined)
          }
          state={state}
          onClose={() => setPreviewingOS(null)}
        />
      )}
    </div>
  );
};
