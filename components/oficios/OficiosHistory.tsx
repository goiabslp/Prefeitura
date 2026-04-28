import React, { useState } from 'react';
import { 
    ArrowLeft, Loader2, Calendar, MapPin, Users, User as UserIcon, 
    RefreshCw, FileText, Search, Hash as HashIcon, Trash2, Edit2, 
    Eye, Edit3, FileDown, Plus 
} from 'lucide-react';
import { Order, User } from '../../types';
import { useInfiniteOficios, useUpdateOficioDescription } from '../../hooks/useOficios';

interface OficiosHistoryProps {
  currentUser: User | null;
  onBack: () => void;
  onEditOrder: (order: Order) => void;
  onDeleteOrder: (id: string) => void;
  onDownloadPdf: (snapshot: any, blockType?: any, order?: Order) => void;
  setPreviewOrder: (order: Order) => void;
  setConfirmModal: (modal: any) => void;
}

export const OficiosHistory: React.FC<OficiosHistoryProps> = ({
  currentUser,
  onBack,
  onEditOrder,
  onDeleteOrder,
  onDownloadPdf,
  setPreviewOrder,
  setConfirmModal
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const {
    data: infiniteOficios,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    refetch,
    isRefetching
  } = useInfiniteOficios(20, searchTerm);

  const updateOficioDescription = useUpdateOficioDescription();

  const oficios = React.useMemo(() => {
    return infiniteOficios?.pages.flat() || [];
  }, [infiniteOficios]);

  const handleDownload = async (order: Order) => {
    setDownloadingId(order.id);
    try {
        onDownloadPdf(order.documentSnapshot, 'oficio', order);
    } finally {
        setTimeout(() => setDownloadingId(null), 1000);
    }
  };

  return (
    <div className="flex-1 h-full w-full bg-slate-100/50 backdrop-blur-sm font-sans flex items-center justify-center p-4 desktop:p-8 overflow-hidden animate-fade-in">
      <div className="w-full max-w-7xl bg-white rounded-[2.5rem] shadow-[0_25px_70px_-15px_rgba(0,0,0,0.15)] border border-slate-200 overflow-hidden animate-slide-up flex flex-col h-full max-h-[90vh]">
        
        {/* Header Padronizado */}
        <div className="p-4 border-b border-slate-100 shrink-0 bg-white transition-all">
          <div className="flex flex-col desktop:flex-row desktop:items-center justify-between gap-4">
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <div className="contents">
                <button
                  onClick={onBack}
                  className="flex items-center gap-2 text-slate-400 hover:text-indigo-600 transition-colors font-bold uppercase tracking-widest group text-[10px] p-2 hover:bg-slate-50 rounded-lg -ml-2"
                  title="Voltar"
                >
                  <ArrowLeft className="transition-transform w-3 h-3 group-hover:-translate-x-1" />
                </button>
                <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3 shrink-0">
                  <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/30">
                    <FileText className="w-4 h-4 text-white" />
                  </div>
                  <span className="truncate uppercase">Histórico de Ofícios</span>
                </h2>
              </div>
            </div>

            <div className="flex-1 max-w-lg flex items-center gap-2">
              <div className="relative flex-1 group">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar ofícios..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 font-medium focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all pl-9 pr-3 py-2 text-xs"
                />
                <Search className="absolute top-1/2 -translate-y-1/2 text-slate-400 left-3 w-3.5 h-3.5 group-focus-within:text-indigo-500 transition-colors" />
              </div>
              <button
                onClick={() => refetch()}
                disabled={isLoading || isRefetching}
                className="flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-slate-600 hover:text-indigo-600 hover:border-indigo-200 transition-all font-bold text-[10px] uppercase tracking-widest whitespace-nowrap active:scale-95 shadow-sm disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${(isLoading || isRefetching) ? 'animate-spin' : ''}`} />
                Atualizar
              </button>
            </div>
          </div>
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-y-auto p-2 desktop:p-4 bg-slate-50/50 custom-scrollbar">
          {/* Header Columns (Desktop Only) */}
          <div className="hidden desktop:grid grid-cols-12 gap-4 px-6 py-3 mb-2 sticky top-0 bg-slate-50/95 backdrop-blur-sm z-10 rounded-xl border border-slate-200/60 shadow-sm text-[10px] font-extrabold tracking-widest text-slate-400 uppercase">
            <div className="col-span-2">Data</div>
            <div className="col-span-2">Número do Ofício</div>
            <div className="col-span-4">Descrição</div>
            <div className="col-span-2">Solicitante</div>
            <div className="col-span-2 text-center">Ações</div>
          </div>

          <div className="space-y-2">
            {isLoading && oficios.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 px-4">
                <div className="relative mb-4">
                  <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <FileText className="w-4 h-4 text-indigo-600" />
                  </div>
                </div>
                <h3 className="text-lg font-bold text-slate-700">Carregando histórico...</h3>
              </div>
            ) : isError ? (
              <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                  <AlertCircle className="w-8 h-8 text-red-500" />
                </div>
                <h3 className="text-lg font-bold text-slate-800">Erro ao carregar</h3>
                <p className="text-slate-500 text-sm mt-1">Não foi possível buscar os ofícios.</p>
              </div>
            ) : oficios.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                  <FileText className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-bold text-slate-800">Nenhum ofício encontrado</h3>
                <p className="text-slate-500 text-sm mt-1 max-w-sm">
                  {searchTerm ? `Nenhum resultado para "${searchTerm}"` : "Ainda não existem ofícios gerados no sistema."}
                </p>
              </div>
            ) : (
              <>
                {oficios.map((order) => {
                  const content = order.documentSnapshot?.content;
                  const createdDate = new Date(order.createdAt);
                  const monthName = createdDate.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase();
                  const yearLabel = createdDate.toLocaleDateString('pt-BR', { year: '2-digit' });
                  
                  const oficioMatch = content?.leftBlockText?.match(/Ofício nº\s*([^\n]+)/i);
                  const oficioNumber = oficioMatch ? oficioMatch[1] : (order.protocol?.replace('OFC-', 'Nº ') || '---');

                  return (
                    <div
                      key={order.id}
                      className="group relative bg-white border border-slate-200 rounded-2xl p-4 desktop:p-0 desktop:px-6 desktop:py-4 flex flex-col desktop:grid desktop:grid-cols-12 gap-4 desktop:gap-4 items-start desktop:items-center transition-all duration-300 hover:shadow-lg hover:border-indigo-200 hover:-translate-y-0.5"
                    >
                      {/* Data */}
                      <div className="desktop:col-span-2 flex items-center gap-4 w-full">
                        <div className="flex flex-col items-center justify-center bg-white border-2 border-slate-100 rounded-xl p-2 w-16 h-16 shrink-0 shadow-sm group-hover:border-indigo-100 group-hover:shadow-indigo-100 transition-all">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{monthName}</span>
                            <span className="text-lg font-black text-slate-700 leading-none mt-0.5">{createdDate.getDate().toString().padStart(2, '0')}</span>
                        </div>
                      </div>

                      {/* Ofício */}
                      <div className="desktop:col-span-2 flex flex-col gap-1 w-full">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1 desktop:hidden">
                              <HashIcon className="w-3 h-3" /> Ofício
                          </span>
                          <span className="font-mono text-xs font-bold text-slate-700 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100 w-fit group-hover:bg-indigo-50/50 group-hover:border-indigo-100 group-hover:text-indigo-700 transition-colors">
                              {oficioNumber}
                          </span>
                      </div>

                      {/* Descrição */}
                      <div className="desktop:col-span-4 w-full pr-4">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1 desktop:hidden mb-1">
                              <FileText className="w-3 h-3" /> Descrição
                          </span>
                          <div className="relative group/input">
                              <input
                                  type="text"
                                  defaultValue={order.description || ''}
                                  onBlur={(e) => {
                                      if ((order.description || '') !== e.target.value) {
                                          updateOficioDescription.mutate({ id: order.id, description: e.target.value });
                                      }
                                  }}
                                  placeholder="Adicionar descrição ao ofício..."
                                  className="w-full bg-slate-50/50 border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 rounded-xl px-3 py-2 placeholder:text-slate-400 transition-all group-hover/input:bg-white"
                              />
                              <Edit2 className="w-3 h-3 text-slate-300 absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover/input:opacity-100 transition-opacity" />
                          </div>
                      </div>

                      {/* Solicitante */}
                      <div className="desktop:col-span-2 w-full">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1 desktop:hidden mb-1">
                              <UserIcon className="w-3 h-3" /> Solicitante
                          </span>
                          <div className="flex flex-col">
                              <span className="text-xs font-bold text-slate-800 line-clamp-1" title={order.userName}>
                                  {order.userName}
                              </span>
                              <span className="text-[10px] text-slate-400 font-medium truncate" title={content?.requesterSector || content?.signatureSector}>
                                  {content?.requesterSector || content?.signatureSector || 'Sem setor'}
                              </span>
                          </div>
                      </div>

                      {/* Ações */}
                      <div className="desktop:col-span-2 flex items-center justify-center gap-1.5 w-full mt-2 desktop:mt-0 opacity-80 group-hover:opacity-100 transition-opacity">
                          <button
                              onClick={() => setPreviewOrder(order)}
                              className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                              title="Visualizar Detalhes"
                          >
                              <Eye className="w-4 h-4" />
                          </button>
                          
                          <button
                              onClick={() => onEditOrder(order)}
                              className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                              title="Editar Ofício"
                          >
                              <Edit3 className="w-4 h-4" />
                          </button>

                          <button
                              onClick={() => handleDownload(order)}
                              disabled={downloadingId === order.id}
                              className={`p-2 rounded-xl transition-all ${downloadingId === order.id ? 'text-indigo-400 bg-indigo-50' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'}`}
                              title="Download PDF"
                          >
                              {downloadingId === order.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                          </button>

                          <button
                              onClick={() => setConfirmModal({
                                  isOpen: true,
                                  title: "Excluir Registro",
                                  message: `Deseja realmente remover o ofício "${oficioNumber}" do histórico?`,
                                  type: 'danger',
                                  onConfirm: () => {
                                      onDeleteOrder(order.id);
                                      setConfirmModal({ isOpen: false });
                                  }
                              })}
                              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                              title="Excluir"
                          >
                              <Trash2 className="w-4 h-4" />
                          </button>
                      </div>
                    </div>
                  );
                })}

                {hasNextPage && (
                  <div className="py-6 flex justify-center mt-4">
                    <button
                        onClick={() => fetchNextPage()}
                        disabled={isFetchingNextPage}
                        className="px-6 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-600 font-bold text-xs uppercase tracking-widest hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all shadow-sm flex items-center gap-2 group disabled:opacity-50"
                    >
                        {isFetchingNextPage ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Carregando...
                            </>
                        ) : (
                            <>
                                <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform" />
                                Mais Resultados
                            </>
                        )}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
