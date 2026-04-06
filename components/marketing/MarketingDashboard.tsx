import React from 'react';
import { Sparkles, PackageCheck, ArrowLeft, Car, Activity } from 'lucide-react';

interface MarketingDashboardProps {
    onNavigate: (view: string, id?: string) => void;
    onBack?: () => void;
    userId: string;
    userRole?: string;
}

export const MarketingDashboard: React.FC<MarketingDashboardProps> = ({ onNavigate, onBack, userId, userRole }) => {
    const isSpecialUser = userRole?.toLowerCase() === 'admin' || userRole?.toLowerCase() === 'marketing' || userRole === 'Administrador' || userRole === 'Marketing';
    return (
        <div id="tour-dashboard" className="flex-1 bg-slate-50 font-sans flex flex-col overflow-hidden relative z-0">
            {/* Fixed Back Button - Standardized Position */}
            <button
                onClick={onBack}
                className="fixed top-24 left-4 md:top-28 md:left-8 z-[999] group flex items-center gap-2 text-slate-500 hover:text-indigo-600 font-bold transition-all p-2 pr-4 rounded-full bg-white/90 backdrop-blur-md border border-slate-200/60 shadow-lg hover:shadow-xl hover:bg-white hover:-translate-y-0.5 hover:border-indigo-100"
                title="Voltar ao Menu"
            >
                <div className="w-8 h-8 rounded-full bg-white border border-slate-100 flex items-center justify-center group-hover:bg-indigo-50 group-hover:border-indigo-100 transition-colors">
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform text-slate-400 group-hover:text-indigo-600" />
                </div>
                <span className="text-[10px] uppercase tracking-widest font-extrabold group-hover:text-indigo-700">Voltar</span>
            </button>

            <div className="flex-1 flex flex-col items-center justify-center w-full h-full p-4 md:p-8 pt-24 md:pt-28 min-h-0 container mx-auto">
                <div className="w-full flex-1 flex flex-col items-center justify-center max-h-full">
                    
                    {/* Header */}
                    <div className="flex flex-col items-center mb-6 md:mb-12 shrink-0 animation-delay-100 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="p-4 rounded-[1.8rem] bg-gradient-to-br from-indigo-50 to-indigo-100/50 mb-4 shadow-sm ring-6 ring-white/50">
                            <Sparkles className="w-10 h-10 text-indigo-600 drop-shadow-sm" />
                        </div>
                        <h2 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight text-center drop-shadow-sm uppercase">Marketing</h2>
                        <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.2em] mt-1 text-center">Demandas e Soluções Criativas</p>
                    </div>

                    {/* Actions Grid - Scaled to match other modules */}
                    <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6 max-w-4xl animate-in zoom-in duration-500 fill-mode-backwards p-2">

                        {/* Card: Novo Conteúdo */}
                        <button
                            id="tour-new-content"
                            onClick={() => onNavigate('new')}
                            className="group relative w-full min-h-[140px] md:min-h-[180px] rounded-[2.5rem] bg-gradient-to-br from-white to-slate-50/50 border border-slate-100 shadow-[0_10px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_25px_60px_rgb(0,0,0,0.12)] hover:shadow-indigo-500/30 hover:border-indigo-200 hover:from-white hover:to-indigo-50/30 transition-all duration-300 ease-spring hover:-translate-y-2 active:scale-95 flex flex-col items-center justify-center overflow-hidden text-center"
                            style={{ animationDelay: '0ms' }}
                        >
                            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-bl-[100%] -mr-10 -mt-10 transition-transform duration-700 ease-out group-hover:scale-150"></div>
                            <div className="absolute bottom-0 left-0 w-24 h-24 bg-indigo-500/5 rounded-tr-[100%] -ml-10 -mb-10 transition-transform duration-700 ease-out group-hover:scale-125 opacity-0 group-hover:opacity-100"></div>

                            <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center mb-3 text-white group-hover:scale-110 group-hover:rotate-6 transition-transform duration-300 shadow-lg shadow-indigo-500/30 ring-4 ring-white">
                                <Sparkles className="w-6 h-6 md:w-7 md:h-7 drop-shadow-md" />
                            </div>

                            <h3 className="text-lg md:text-2xl font-bold text-slate-800 mb-1 group-hover:text-slate-900 tracking-tight uppercase">Novo Conteúdo</h3>
                            <p className="text-[10px] md:text-xs font-bold text-slate-400 group-hover:text-indigo-600 transition-colors uppercase tracking-widest text-center px-4">Fazer um novo pedido</p>
                        </button>

                        {/* Card: Meus Conteúdos */}
                        <button
                            id="tour-list-content"
                            onClick={() => onNavigate('list')}
                            className="group relative w-full min-h-[140px] md:min-h-[180px] rounded-[2.5rem] bg-gradient-to-br from-white to-slate-50/50 border border-slate-100 shadow-[0_10px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_25px_60px_rgb(0,0,0,0.12)] hover:shadow-emerald-500/30 hover:border-emerald-200 hover:from-white hover:to-emerald-50/30 transition-all duration-300 ease-spring hover:-translate-y-2 active:scale-95 flex flex-col items-center justify-center overflow-hidden text-center"
                            style={{ animationDelay: '100ms' }}
                        >
                            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-bl-[100%] -mr-10 -mt-10 transition-transform duration-700 ease-out group-hover:scale-150"></div>
                            <div className="absolute bottom-0 left-0 w-24 h-24 bg-emerald-500/5 rounded-tr-[100%] -ml-10 -mb-10 transition-transform duration-700 ease-out group-hover:scale-125 opacity-0 group-hover:opacity-100"></div>

                            <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center mb-3 text-white group-hover:scale-110 group-hover:rotate-6 transition-transform duration-300 shadow-lg shadow-emerald-500/30 ring-4 ring-white">
                                <PackageCheck className="w-6 h-6 md:w-7 md:h-7 drop-shadow-md" />
                            </div>

                            <h3 className="text-lg md:text-2xl font-bold text-slate-800 mb-1 group-hover:text-slate-900 tracking-tight uppercase">
                                {isSpecialUser ? 'Gestão de Conteúdos' : 'Meus Conteúdos'}
                            </h3>
                            <p className="text-[10px] md:text-xs font-bold text-slate-400 group-hover:text-emerald-600 transition-colors uppercase tracking-widest text-center px-4">
                                {isSpecialUser ? 'Visualizar e gerenciar solicitações' : 'Visualizar os pedidos realizados'}
                            </p>
                        </button>

                    </div>

                    {/* Branding / Tagline */}
                    <div className="mt-12 md:mt-16 opacity-30 animation-delay-500 animate-in fade-in duration-1000">
                        <div className="flex items-center gap-3 grayscale cursor-default">
                             <div className="h-px w-8 bg-slate-400"></div>
                             <span className="text-[8px] font-black uppercase tracking-[0.4em] text-slate-600">Esteira de Produção Criativa</span>
                             <div className="h-px w-8 bg-slate-400"></div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};
