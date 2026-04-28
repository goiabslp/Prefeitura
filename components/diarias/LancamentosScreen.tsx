import React, { useEffect, useState } from 'react';
import { ArrowLeft, Loader2, Calendar, MapPin, Users, User as UserIcon, RefreshCw, FileText, Search, Filter, Hash as HashIcon } from 'lucide-react';
import { DiariaEvento, User } from '../../types';
import { getDiariaEventosBySector, getAllDiariaEventos } from '../../services/diariasEventosService';

interface LancamentosScreenProps {
  currentUser: User | null;
  onBack: () => void;
}

export const LancamentosScreen: React.FC<LancamentosScreenProps> = ({
  currentUser,
  onBack
}) => {
  const [eventos, setEventos] = useState<DiariaEvento[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchEventos = async () => {
    setIsLoading(true);
    try {
      let data: DiariaEvento[] = [];
      if (currentUser?.role === 'admin') {
        data = await getAllDiariaEventos();
      } else if (currentUser?.sectorId) {
        data = await getDiariaEventosBySector(currentUser.sectorId);
      }
      setEventos(data);
    } catch (error) {
      console.error(error);
      alert("Erro ao buscar lançamentos.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEventos();
  }, [currentUser]);

  const formatDate = (dateString: string) => {
    const d = new Date(dateString);
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    }).format(d);
  };

  const filteredEventos = eventos.filter(evento => {
    const term = searchTerm.toLowerCase();
    return evento.destino.toLowerCase().includes(term) ||
           evento.motivo.toLowerCase().includes(term) ||
           evento.pessoas.some(p => p.name.toLowerCase().includes(term));
  });

  return (
    <div className="flex-1 h-full w-full bg-slate-100/50 backdrop-blur-sm font-sans flex items-center justify-center p-4 desktop:p-8 overflow-hidden animate-fade-in">
      <div className="w-full max-w-7xl bg-white rounded-[2.5rem] shadow-[0_25px_70px_-15px_rgba(0,0,0,0.15)] border border-slate-200 overflow-hidden animate-slide-up flex flex-col h-full max-h-full">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-100 shrink-0 bg-white transition-all">
          <div className="flex flex-col desktop:flex-row desktop:items-center justify-between gap-4">
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <div className="contents">
                <button
                  onClick={onBack}
                  className="flex items-center gap-2 text-slate-400 hover:text-indigo-600 transition-colors font-bold uppercase tracking-widest group text-[10px] p-2 hover:bg-slate-50 rounded-lg -ml-2"
                  title="Voltar"
                >
                  <ArrowLeft className="transition-transform w-3 h-3" />
                </button>
                <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3 shrink-0">
                  <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/30">
                    <FileText className="w-4 h-4 text-white" />
                  </div>
                  <span className="truncate uppercase">Histórico: EVENTOS</span>
                </h2>
              </div>
            </div>

            <div className="flex-1 max-w-lg flex items-center gap-2">
              <div className="relative flex-1 group">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 font-medium focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all pl-9 pr-3 py-2 text-xs"
                />
                <Search className="absolute top-1/2 -translate-y-1/2 text-slate-400 left-3 w-3.5 h-3.5" />
              </div>
              <button
                onClick={fetchEventos}
                disabled={isLoading}
                className="flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-slate-600 hover:text-indigo-600 hover:border-indigo-200 transition-all font-bold text-[10px] uppercase tracking-widest whitespace-nowrap active:scale-95 shadow-sm disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                Atualizar
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto custom-scrollbar bg-white">
          {isLoading ? (
            <div className="h-full flex flex-col items-center justify-center space-y-4">
              <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
              <p className="text-slate-400 font-medium text-sm animate-pulse">Carregando lançamentos...</p>
            </div>
          ) : filteredEventos.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 h-full">
              <div className="bg-slate-50 rounded-[2rem] border border-slate-100 p-12 text-center flex flex-col items-center justify-center w-full max-w-2xl mx-auto shadow-sm">
                <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm border border-slate-100">
                  <FileText className="w-8 h-8 text-slate-300" />
                </div>
                <h3 className="text-lg font-black text-slate-900 mb-2 tracking-tight">
                  {searchTerm ? 'Nenhum resultado encontrado' : 'Nenhum evento registrado'}
                </h3>
                <p className="text-sm text-slate-500 font-medium">
                  {searchTerm 
                    ? 'Tente ajustar os termos da sua pesquisa.' 
                    : 'Ainda não há eventos cadastrados.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="min-w-full">
              {/* Table Header */}
              <div className="border-b border-slate-100 bg-slate-50 hidden desktop:grid desktop:grid-cols-12 gap-4 px-8 py-4 sticky top-0 z-10">
                <div className="md:col-span-1 text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-center gap-2 whitespace-nowrap">
                  <Calendar className="w-3 h-3" /> Data
                </div>
                <div className="md:col-span-1 text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-center gap-2 whitespace-nowrap">
                  <HashIcon className="w-3 h-3" /> ID
                </div>
                <div className="md:col-span-3 text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 whitespace-nowrap">
                  <MapPin className="w-3 h-3" /> Destino / Pessoas
                </div>
                <div className="md:col-span-4 text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 whitespace-nowrap">
                  <FileText className="w-3 h-3" /> Motivo do Evento
                </div>
                <div className="md:col-span-2 text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-center gap-2 whitespace-nowrap">
                  Status
                </div>
                <div className="md:col-span-1 text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-center gap-2 whitespace-nowrap">
                  Ações
                </div>
              </div>

              {/* Table Body */}
              <div className="divide-y divide-slate-100">
                {filteredEventos.map(evento => {
                  const createdDate = new Date(evento.created_at);
                  const monthName = createdDate.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase();
                  const yearLabel = createdDate.toLocaleDateString('pt-BR', { year: '2-digit' });

                  return (
                    <div key={evento.id} className="grid grid-cols-1 desktop:grid-cols-12 gap-4 px-8 py-5 hover:bg-slate-50/80 transition-colors items-center">
                      
                      {/* Data (Box igual Compras) */}
                      <div className="md:col-span-1 flex justify-center">
                        <div className="w-11 h-11 bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center shadow-sm shrink-0">
                          <span className="text-[7px] font-black text-slate-400 uppercase">
                            {monthName}/{yearLabel}
                          </span>
                          <span className="text-base font-black text-emerald-600 leading-none">
                            {createdDate.getDate()}
                          </span>
                        </div>
                      </div>

                      {/* ID Pill */}
                      <div className="md:col-span-1 flex justify-center">
                        <span className="font-mono text-[10px] font-bold text-indigo-600 bg-indigo-50/50 px-2 py-1 rounded border border-indigo-100/50">
                          EVT-{evento.id.slice(0,4).toUpperCase()}
                        </span>
                      </div>

                      {/* Destino e Pessoas */}
                      <div className="md:col-span-3">
                        <h3 className="text-sm font-bold text-slate-800 leading-tight truncate" title={evento.destino}>
                          {evento.destino}
                        </h3>
                        <p className="text-[10px] text-slate-400 font-medium mt-1 flex items-center gap-1">
                          <Users className="w-3 h-3" /> {evento.pessoas.length} {evento.pessoas.length === 1 ? 'Pessoa' : 'Pessoas'}
                        </p>
                      </div>

                      {/* Motivo */}
                      <div className="md:col-span-4">
                        <p className="text-xs text-slate-600 font-medium line-clamp-2" title={evento.motivo}>
                          {evento.motivo}
                        </p>
                        <p className="text-[9px] text-slate-400 font-medium mt-1 flex items-center gap-1">
                           Lançado por {evento.user_name}
                        </p>
                      </div>

                      {/* Status */}
                      <div className="md:col-span-2 flex justify-center">
                         <div className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full border border-indigo-200 bg-indigo-50 text-indigo-700 shadow-sm">
                            <span className="text-[9px] font-black uppercase tracking-widest">
                                Registrado
                            </span>
                         </div>
                      </div>

                      {/* Ações (Placeholders) */}
                      <div className="md:col-span-1 flex items-center justify-center gap-2 opacity-50 hover:opacity-100 transition-opacity">
                        <button className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all" title="Ver Detalhes">
                          <FileText className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
