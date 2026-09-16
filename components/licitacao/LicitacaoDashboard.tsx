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
                <div className="flex-1 w-full p-4 md:p-6 overflow-y-auto lg:overflow-hidden flex flex-col justify-center items-center">
                    <div className="w-full max-h-full flex flex-col items-center justify-center container mx-auto">
                        <div className="flex flex-col items-center mb-5 md:mb-7 shrink-0 animation-delay-100 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="p-3 md:p-3.5 rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100/50 mb-2.5 shadow-xs ring-4 ring-white/60">
                                <Gavel className="w-8 h-8 md:w-9 md:h-9 text-blue-600 drop-shadow-sm" />
                            </div>
                            <h2 className="text-2xl md:text-3xl lg:text-4xl font-black text-slate-800 tracking-tight text-center drop-shadow-sm">Módulo de Licitação</h2>
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">Gestão de processos e fluxo de compras públicas</p>
                        </div>

                        <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 desktop:gap-4 max-w-5xl animate-in zoom-in duration-500 fill-mode-backwards p-2">
                            {/* Novo Pedido Button */}
                            <button
                                onClick={() => onNavigate('licitacao:new')}
                                className="group relative w-full min-h-[110px] md:min-h-[135px] py-4 md:py-5 px-3 md:px-4 rounded-[2rem] bg-gradient-to-br from-white to-slate-50/50 border border-slate-100 shadow-[0_10px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_25px_60px_rgb(0,0,0,0.12)] hover:shadow-blue-500/30 hover:border-blue-200 hover:from-white hover:to-blue-50/30 transition-all duration-300 ease-spring hover:-translate-y-1.5 active:scale-95 flex flex-col items-center justify-center overflow-hidden shrink-0"
                                style={{ animationDelay: '0ms' }}
                            >
                                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-bl-[100%] -mr-10 -mt-10 transition-transform duration-700 ease-out group-hover:scale-150"></div>
                                <div className="absolute bottom-0 left-0 w-24 h-24 bg-blue-500/5 rounded-tr-[100%] -ml-10 -mb-10 transition-transform duration-700 ease-out group-hover:scale-125 opacity-0 group-hover:opacity-100"></div>

                                <div className="relative w-11 h-11 md:w-12 md:h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center mb-2.5 text-white group-hover:scale-110 group-hover:rotate-6 transition-transform duration-300 shadow-md shadow-blue-500/30 ring-4 ring-white">
                                    <FilePlus className="w-5 h-5 md:w-6 md:h-6 drop-shadow-md" />
                                </div>

                                <h3 className="text-base md:text-lg lg:text-xl font-bold text-slate-800 mb-0.5 group-hover:text-slate-900 tracking-tight text-center">Novo Pedido</h3>
                                <p className="text-[9px] md:text-[10px] font-bold text-slate-400 group-hover:text-blue-600 transition-colors uppercase tracking-wider text-center">Criar novo registro</p>
                            </button>

                            {/* Meus Processos Button */}
                            <button
                                onClick={() => onNavigate('licitacao:details')}
                                className="group relative w-full min-h-[110px] md:min-h-[135px] py-4 md:py-5 px-3 md:px-4 rounded-[2rem] bg-gradient-to-br from-white to-slate-50/50 border border-slate-100 shadow-[0_10px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_25px_60px_rgb(0,0,0,0.12)] hover:shadow-sky-500/30 hover:border-sky-200 hover:from-white hover:to-sky-50/30 transition-all duration-300 ease-spring hover:-translate-y-1.5 active:scale-95 flex flex-col items-center justify-center overflow-hidden shrink-0"
                                style={{ animationDelay: '100ms' }}
                            >
                                <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/5 rounded-bl-[100%] -mr-10 -mt-10 transition-transform duration-700 ease-out group-hover:scale-150"></div>
                                <div className="absolute bottom-0 left-0 w-24 h-24 bg-sky-500/5 rounded-tr-[100%] -ml-10 -mb-10 transition-transform duration-700 ease-out group-hover:scale-125 opacity-0 group-hover:opacity-100"></div>

                                <div className="relative w-11 h-11 md:w-12 md:h-12 rounded-xl bg-gradient-to-br from-sky-500 to-sky-600 flex items-center justify-center mb-2.5 text-white group-hover:scale-110 group-hover:rotate-6 transition-transform duration-300 shadow-md shadow-sky-500/30 ring-4 ring-white">
                                    <History className="w-5 h-5 md:w-6 md:h-6 drop-shadow-md" />
                                </div>

                                <h3 className="text-base md:text-lg lg:text-xl font-bold text-slate-800 mb-0.5 group-hover:text-slate-900 tracking-tight text-center">Meus Processos</h3>
                                <p className="text-[9px] md:text-[10px] font-bold text-slate-400 group-hover:text-sky-600 transition-colors uppercase tracking-wider text-center">Acompanhe e gerencie</p>
                            </button>

                            {/* Quadro Kanban Button */}
                            <button
                                onClick={() => onNavigate('licitacao:kanban')}
                                className="group relative w-full min-h-[110px] md:min-h-[135px] py-4 md:py-5 px-3 md:px-4 rounded-[2rem] bg-gradient-to-br from-white to-slate-50/50 border border-slate-100 shadow-[0_10px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_25px_60px_rgb(0,0,0,0.12)] hover:shadow-purple-500/30 hover:border-purple-200 hover:from-white hover:to-purple-50/30 transition-all duration-300 ease-spring hover:-translate-y-1.5 active:scale-95 flex flex-col items-center justify-center overflow-hidden shrink-0"
                                style={{ animationDelay: '200ms' }}
                            >
                                <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-bl-[100%] -mr-10 -mt-10 transition-transform duration-700 ease-out group-hover:scale-150"></div>
                                <div className="absolute bottom-0 left-0 w-24 h-24 bg-purple-500/5 rounded-tr-[100%] -ml-10 -mb-10 transition-transform duration-700 ease-out group-hover:scale-125 opacity-0 group-hover:opacity-100"></div>

                                <div className="relative w-11 h-11 md:w-12 md:h-12 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center mb-2.5 text-white group-hover:scale-110 group-hover:rotate-6 transition-transform duration-300 shadow-md shadow-purple-500/30 ring-4 ring-white">
                                    <LayoutGrid className="w-5 h-5 md:w-6 md:h-6 drop-shadow-md" />
                                </div>

                                <h3 className="text-base md:text-lg lg:text-xl font-bold text-slate-800 mb-0.5 group-hover:text-slate-900 tracking-tight text-center">Quadro Kanban</h3>
                                <p className="text-[9px] md:text-[10px] font-bold text-slate-400 group-hover:text-purple-600 transition-colors uppercase tracking-wider text-center">Fluxo em Tempo Real</p>
                            </button>

                            {/* Painel de Acompanhamento (View) Button */}
                            <button
                                onClick={() => onNavigate('licitacao:kanban-view')}
                                className="group relative w-full min-h-[110px] md:min-h-[135px] py-4 md:py-5 px-3 md:px-4 rounded-[2rem] bg-gradient-to-br from-white to-slate-50/50 border border-slate-100 shadow-[0_10px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_25px_60px_rgb(0,0,0,0.12)] hover:shadow-emerald-500/30 hover:border-emerald-200 hover:from-white hover:to-emerald-50/30 transition-all duration-300 ease-spring hover:-translate-y-1.5 active:scale-95 flex flex-col items-center justify-center overflow-hidden shrink-0"
                                style={{ animationDelay: '300ms' }}
                            >
                                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-bl-[100%] -mr-10 -mt-10 transition-transform duration-700 ease-out group-hover:scale-150"></div>
                                <div className="absolute bottom-0 left-0 w-24 h-24 bg-emerald-500/5 rounded-tr-[100%] -ml-10 -mb-10 transition-transform duration-700 ease-out group-hover:scale-125 opacity-0 group-hover:opacity-100"></div>

                                <div className="relative w-11 h-11 md:w-12 md:h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center mb-2.5 text-white group-hover:scale-110 group-hover:rotate-6 transition-transform duration-300 shadow-md shadow-emerald-500/30 ring-4 ring-white">
                                    <Tv className="w-5 h-5 md:w-6 md:h-6 drop-shadow-md" />
                                </div>

                                <h3 className="text-base md:text-lg lg:text-xl font-bold text-slate-800 mb-0.5 group-hover:text-slate-900 tracking-tight text-center">Painel Visualização</h3>
                                <p className="text-[9px] md:text-[10px] font-bold text-slate-400 group-hover:text-emerald-600 transition-colors uppercase tracking-wider text-center">Atualiza a cada 10 min</p>
                            </button>

                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

