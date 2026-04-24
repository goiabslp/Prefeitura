import React, { useEffect, useState } from 'react';
import { ArrowLeft, Loader2, Calendar, MapPin, Users, User as UserIcon, RefreshCw, FileText } from 'lucide-react';
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

  const fetchEventos = async () => {
    setIsLoading(true);
    try {
      // Se for admin, carrega de todos. Se não, apenas do setor
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

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white border-b border-slate-200 px-6 py-1 flex items-center justify-between shadow-sm min-h-[50px]">
        <button
          onClick={onBack}
          className="flex items-center gap-2 group px-3 py-2 transition-all font-black uppercase tracking-tighter text-[11px] text-slate-400 hover:text-slate-900"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span>Voltar</span>
        </button>
        <div className="flex-1 flex justify-center">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-widest">
            Lançamentos de Eventos
          </h2>
        </div>
        <div className="min-w-[140px] flex justify-end">
          <button
            onClick={fetchEventos}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 active:scale-95 transition-all text-xs disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 lg:p-12 bg-slate-50 flex flex-col" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        <style>{`
          .hide-scroll::-webkit-scrollbar {
            display: none;
          }
        `}</style>
        <div className="flex-1 flex flex-col w-full max-w-4xl mx-auto hide-scroll">
          {isLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center py-20 text-slate-400">
              <Loader2 className="w-10 h-10 animate-spin mb-4 text-indigo-500" />
              <p className="text-sm font-medium">Buscando lançamentos...</p>
            </div>
          ) : eventos.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center">
              <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center flex flex-col items-center justify-center w-full shadow-sm">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                  <FileText className="w-8 h-8 text-slate-300" />
                </div>
                <h3 className="text-lg font-black text-slate-900 mb-2">Nenhum evento registrado</h3>
                <p className="text-sm text-slate-500">
                  {currentUser?.role === 'admin' 
                    ? 'Ainda não há nenhum evento registrado no sistema.' 
                    : 'Seu setor ainda não possui nenhum evento registrado.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 pb-8">
              {eventos.map((evento) => (
                <div key={evento.id} className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-sm hover:shadow-lg transition-shadow">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                    {/* Infos Principais */}
                    <div className="flex-1 space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center shrink-0">
                          <MapPin className="w-5 h-5 text-indigo-600" />
                        </div>
                        <h4 className="font-bold text-slate-900 text-lg md:text-xl">{evento.destino}</h4>
                      </div>
                      <div className="flex items-start gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <FileText className="w-5 h-5 text-slate-400 mt-0.5 shrink-0" />
                        <p className="text-sm md:text-base text-slate-700 leading-relaxed font-medium">{evento.motivo}</p>
                      </div>
                    </div>
                    
                    {/* Datas e Metadados */}
                    <div className="w-full md:min-w-[320px] md:max-w-[320px] bg-white rounded-2xl p-5 space-y-4 border border-slate-200 shadow-sm">
                      <div className="flex items-center justify-between text-sm font-semibold text-slate-700">
                        <span className="flex items-center gap-2"><Calendar className="w-4 h-4 text-slate-400"/> Saída:</span>
                        <span className="text-slate-900">{formatDate(evento.data_saida)}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm font-semibold text-slate-700">
                        <span className="flex items-center gap-2"><Calendar className="w-4 h-4 text-slate-400"/> Retorno:</span>
                        <span className="text-slate-900">{formatDate(evento.data_retorno)}</span>
                      </div>
                      <div className="pt-4 border-t border-slate-100">
                        <div className="flex items-center gap-2 text-sm font-medium text-slate-600 bg-slate-50 px-3 py-2 rounded-lg">
                          <UserIcon className="w-4 h-4 text-slate-400" />
                          <span>Lançado por: <span className="text-slate-900 font-bold">{evento.user_name}</span></span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Pessoas */}
                  <div className="mt-6 pt-6 border-t border-slate-100">
                    <div className="flex items-start gap-3">
                      <Users className="w-5 h-5 text-slate-400 mt-1 shrink-0" />
                      <div className="flex flex-wrap gap-2.5">
                        {evento.pessoas.map(p => (
                          <span key={p.id} className="px-3.5 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold border border-indigo-100 shadow-sm">
                            {p.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
