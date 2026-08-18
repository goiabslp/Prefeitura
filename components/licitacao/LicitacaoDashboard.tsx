import React from 'react';
import { ArrowLeft, FilePlus, History, Gavel, LayoutGrid, Tv } from 'lucide-react';

interface LicitacaoDashboardProps {
    onNavigate: (view: 'licitacao:new' | 'licitacao:details' | 'licitacao:kanban' | 'licitacao:kanban-view') => void;
    onBack: () => void;
}

export const LicitacaoDashboard: React.FC<LicitacaoDashboardProps> = ({ onNavigate, onBack }) => {
    return (
        <div className="flex-1 flex flex-col overflow-hidden bg-[#FAFAFA] relative animate-fade-in z-0 font-sans">
            {/* Fixed Back Button */}
            <button
                onClick={onBack}
                className="fixed top-20 left-4 desktop:top-24 desktop:left-8 z-[999] group flex items-center gap-2 text-slate-500 hover:text-indigo-600 font-bold transition-all p-2 pr-4 rounded-full bg-white/90 backdrop-blur-md border border-slate-200/60 shadow-lg hover:shadow-xl hover:bg-white hover:-translate-y-0.5 hover:border-indigo-100"
                title="Voltar ao Menu"
            >
                <div className="w-8 h-8 rounded-full bg-white border border-slate-100 flex items-center justify-center group-hover:bg-indigo-50 group-hover:border-indigo-100 transition-colors">
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform text-slate-400 group-hover:text-indigo-600" />
                </div>
                <span className="text-[10px] uppercase tracking-widest font-extrabold group-hover:text-indigo-700">Voltar</span>
            </button>

            <div className="w-full h-full flex flex-col relative animate-fade-in z-0 overflow-hidden">
                <div className="flex-1 w-full h-full p-4 desktop:p-8 pt-20 desktop:pt-24">
                    <div className="w-full min-h-full flex flex-col items-center justify-center container mx-auto">
                        <div className="flex flex-col items-center mb-8 shrink-0 animation-delay-100 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="p-5 rounded-[2rem] bg-gradient-to-br from-blue-50 to-blue-100/50 mb-5 shadow-sm ring-8 ring-white/50">
                                <Gavel className="w-12 h-12 text-blue-600 drop-shadow-sm" />
                            </div>
                            <h2 className="text-3xl desktop:text-5xl font-black text-slate-800 tracking-tight text-center drop-shadow-sm">Módulo de Licitação</h2>
                        </div>

                        <div className="w-full flex flex-wrap justify-center items-stretch gap-3 desktop:gap-4 max-w-6xl animate-in zoom-in duration-500 fill-mode-backwards p-2">
                            {/* Novo Pedido Button */}
                            <button
                                onClick={() => onNavigate('licitacao:new')}
                                className="group relative flex-1 min-w-[240px] desktop:min-w-[260px] max-w-[360px] min-h-[120px] desktop:min-h-[130px] h-auto py-6 rounded-[2.5rem] bg-gradient-to-br from-white to-slate-50/50 border border-slate-100 shadow-[0_10px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_25px_60px_rgb(0,0,0,0.12)] hover:shadow-blue-500/30 hover:border-blue-200 hover:from-white hover:to-blue-50/30 transition-all duration-300 ease-spring hover:-translate-y-2 active:scale-95 flex flex-col items-center justify-center overflow-hidden shrink-0 basis-0 grow"
                                style={{ animationDelay: '0ms' }}
                            >
                                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-bl-[100%] -mr-10 -mt-10 transition-transform duration-700 ease-out group-hover:scale-150"></div>
                                <div className="absolute bottom-0 left-0 w-24 h-24 bg-blue-500/5 rounded-tr-[100%] -ml-10 -mb-10 transition-transform duration-700 ease-out group-hover:scale-125 opacity-0 group-hover:opacity-100"></div>

                                <div className="relative w-12 h-12 desktop:w-14 desktop:h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center mb-3 text-white group-hover:scale-110 group-hover:rotate-6 transition-transform duration-300 shadow-lg shadow-blue-500/30 ring-4 ring-white">
                                    <FilePlus className="w-6 h-6 desktop:w-7 desktop:h-7 drop-shadow-md" />
                                </div>

                                <h3 className="text-lg desktop:text-2xl font-bold text-slate-800 mb-1 group-hover:text-slate-900 tracking-tight">Novo Pedido</h3>
                                <p className="text-[10px] desktop:text-xs font-bold text-slate-400 group-hover:text-blue-600 transition-colors uppercase tracking-widest">Criar novo registro</p>
                            </button>

                            {/* Meus Processos Button */}
                            <button
                                onClick={() => onNavigate('licitacao:details')}
                                className="group relative flex-1 min-w-[240px] desktop:min-w-[260px] max-w-[360px] min-h-[120px] desktop:min-h-[130px] h-auto py-6 rounded-[2.5rem] bg-gradient-to-br from-white to-slate-50/50 border border-slate-100 shadow-[0_10px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_25px_60px_rgb(0,0,0,0.12)] hover:shadow-sky-500/30 hover:border-sky-200 hover:from-white hover:to-sky-50/30 transition-all duration-300 ease-spring hover:-translate-y-2 active:scale-95 flex flex-col items-center justify-center overflow-hidden shrink-0 basis-0 grow"
                                style={{ animationDelay: '100ms' }}
                            >
                                <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/5 rounded-bl-[100%] -mr-10 -mt-10 transition-transform duration-700 ease-out group-hover:scale-150"></div>
                                <div className="absolute bottom-0 left-0 w-24 h-24 bg-sky-500/5 rounded-tr-[100%] -ml-10 -mb-10 transition-transform duration-700 ease-out group-hover:scale-125 opacity-0 group-hover:opacity-100"></div>

                                <div className="relative w-12 h-12 desktop:w-14 desktop:h-14 rounded-2xl bg-gradient-to-br from-sky-500 to-sky-600 flex items-center justify-center mb-3 text-white group-hover:scale-110 group-hover:rotate-6 transition-transform duration-300 shadow-lg shadow-sky-500/30 ring-4 ring-white">
                                    <History className="w-6 h-6 desktop:w-7 desktop:h-7 drop-shadow-md" />
                                </div>

                                <h3 className="text-lg desktop:text-2xl font-bold text-slate-800 mb-1 group-hover:text-slate-900 tracking-tight">Meus Processos</h3>
                                <p className="text-[10px] desktop:text-xs font-bold text-slate-400 group-hover:text-sky-600 transition-colors uppercase tracking-widest">Acompanhe e gerencie</p>
                            </button>

                            {/* Quadro Kanban Button */}
                            <button
                                onClick={() => onNavigate('licitacao:kanban')}
                                className="group relative flex-1 min-w-[240px] desktop:min-w-[260px] max-w-[360px] min-h-[120px] desktop:min-h-[130px] h-auto py-6 rounded-[2.5rem] bg-gradient-to-br from-white to-slate-50/50 border border-slate-100 shadow-[0_10px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_25px_60px_rgb(0,0,0,0.12)] hover:shadow-purple-500/30 hover:border-purple-200 hover:from-white hover:to-purple-50/30 transition-all duration-300 ease-spring hover:-translate-y-2 active:scale-95 flex flex-col items-center justify-center overflow-hidden shrink-0 basis-0 grow"
                                style={{ animationDelay: '200ms' }}
                            >
                                <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-bl-[100%] -mr-10 -mt-10 transition-transform duration-700 ease-out group-hover:scale-150"></div>
                                <div className="absolute bottom-0 left-0 w-24 h-24 bg-purple-500/5 rounded-tr-[100%] -ml-10 -mb-10 transition-transform duration-700 ease-out group-hover:scale-125 opacity-0 group-hover:opacity-100"></div>

                                <div className="relative w-12 h-12 desktop:w-14 desktop:h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center mb-3 text-white group-hover:scale-110 group-hover:rotate-6 transition-transform duration-300 shadow-lg shadow-purple-500/30 ring-4 ring-white">
                                    <LayoutGrid className="w-6 h-6 desktop:w-7 desktop:h-7 drop-shadow-md" />
                                </div>

                                <h3 className="text-lg desktop:text-2xl font-bold text-slate-800 mb-1 group-hover:text-slate-900 tracking-tight">Quadro Kanban</h3>
                                <p className="text-[10px] desktop:text-xs font-bold text-slate-400 group-hover:text-purple-600 transition-colors uppercase tracking-widest">Fluxo em Tempo Real</p>
                            </button>

                            {/* Painel de Acompanhamento (View) Button */}
                            <button
                                onClick={() => onNavigate('licitacao:kanban-view')}
                                className="group relative flex-1 min-w-[240px] desktop:min-w-[260px] max-w-[360px] min-h-[120px] desktop:min-h-[130px] h-auto py-6 rounded-[2.5rem] bg-gradient-to-br from-white to-slate-50/50 border border-slate-100 shadow-[0_10px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_25px_60px_rgb(0,0,0,0.12)] hover:shadow-emerald-500/30 hover:border-emerald-200 hover:from-white hover:to-emerald-50/30 transition-all duration-300 ease-spring hover:-translate-y-2 active:scale-95 flex flex-col items-center justify-center overflow-hidden shrink-0 basis-0 grow"
                                style={{ animationDelay: '300ms' }}
                            >
                                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-bl-[100%] -mr-10 -mt-10 transition-transform duration-700 ease-out group-hover:scale-150"></div>
                                <div className="absolute bottom-0 left-0 w-24 h-24 bg-emerald-500/5 rounded-tr-[100%] -ml-10 -mb-10 transition-transform duration-700 ease-out group-hover:scale-125 opacity-0 group-hover:opacity-100"></div>

                                <div className="relative w-12 h-12 desktop:w-14 desktop:h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center mb-3 text-white group-hover:scale-110 group-hover:rotate-6 transition-transform duration-300 shadow-lg shadow-emerald-500/30 ring-4 ring-white">
                                    <Tv className="w-6 h-6 desktop:w-7 desktop:h-7 drop-shadow-md" />
                                </div>

                                <h3 className="text-lg desktop:text-2xl font-bold text-slate-800 mb-1 group-hover:text-slate-900 tracking-tight">Painel Visualização</h3>
                                <p className="text-[10px] desktop:text-xs font-bold text-slate-400 group-hover:text-emerald-600 transition-colors uppercase tracking-widest">Atualiza a cada 10 min</p>
                            </button>

                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

