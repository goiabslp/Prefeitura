import React from 'react';
import { ArrowLeft, PlusCircle, List, Car } from 'lucide-react';

interface MotoristaModuleProps {
    onBack: () => void;
    onNavigate: (view: string) => void;
}

export const MotoristaModule: React.FC<MotoristaModuleProps> = ({ onBack, onNavigate }) => {
    return (
        <div className="flex-1 w-full h-full bg-[#f8fafc] relative flex flex-col overflow-hidden min-h-0 font-sans">
            <div className="flex-1 flex flex-col items-center justify-center w-full h-full min-h-[80vh] container mx-auto p-4 relative">
                
                {/* Back Button */}
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

                <div className="w-full flex-1 flex flex-col items-center justify-center max-h-full mt-16 md:mt-0">
                    
                    {/* Header */}
                    <div className="flex flex-col items-center mb-6 md:mb-12 shrink-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="p-4 rounded-[1.8rem] bg-gradient-to-br from-indigo-50 to-indigo-100/50 mb-4 shadow-sm ring-6 ring-white/50">
                            <Car className="w-10 h-10 text-indigo-600 drop-shadow-sm animate-pulse" />
                        </div>
                        <h2 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight text-center drop-shadow-sm uppercase">Motorista</h2>
                        <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.2em] mt-1 text-center">Gestão completa de viagens, rotas e andamentos</p>
                    </div>

                    {/* Cards Grid */}
                    <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6 max-w-4xl animate-in zoom-in duration-500 fill-mode-backwards p-2">
                        
                        {/* Nova Viagem Card */}
                        <button
                            onClick={() => onNavigate('motorista:nova-viagem')}
                            className="group relative w-full min-h-[140px] md:min-h-[180px] rounded-[2.5rem] bg-gradient-to-br from-white to-slate-50/50 border border-slate-100 shadow-[0_10px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_25px_60px_rgb(0,0,0,0.12)] hover:shadow-indigo-500/30 hover:border-indigo-200 hover:from-white hover:to-indigo-50/30 transition-all duration-300 ease-spring hover:-translate-y-2 active:scale-95 flex flex-col items-center justify-center overflow-hidden text-center"
                        >
                            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-bl-[100%] -mr-10 -mt-10 transition-transform duration-700 ease-out group-hover:scale-150"></div>
                            <div className="absolute bottom-0 left-0 w-24 h-24 bg-indigo-500/5 rounded-tr-[100%] -ml-10 -mb-10 transition-transform duration-700 ease-out group-hover:scale-125 opacity-0 group-hover:opacity-100"></div>

                            <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center mb-3 text-white group-hover:scale-110 group-hover:rotate-6 transition-transform duration-300 shadow-lg shadow-indigo-500/30 ring-4 ring-white z-10">
                                <PlusCircle className="w-6 h-6 md:w-7 md:h-7 drop-shadow-md" />
                            </div>

                            <h3 className="text-lg md:text-2xl font-bold text-slate-800 mb-1 group-hover:text-slate-900 tracking-tight uppercase z-10">Nova Viagem</h3>
                            <p className="text-[10px] md:text-xs font-bold text-slate-400 group-hover:text-indigo-600 transition-colors uppercase tracking-widest text-center px-4 z-10">Iniciar um novo registro de viagem ou rota</p>
                        </button>

                        {/* Minhas Viagens Card */}
                        <button
                            onClick={() => onNavigate('motorista:minhas-viagens')}
                            className="group relative w-full min-h-[140px] md:min-h-[180px] rounded-[2.5rem] bg-gradient-to-br from-white to-slate-50/50 border border-slate-100 shadow-[0_10px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_25px_60px_rgb(0,0,0,0.12)] hover:shadow-emerald-500/30 hover:border-emerald-200 hover:from-white hover:to-emerald-50/30 transition-all duration-300 ease-spring hover:-translate-y-2 active:scale-95 flex flex-col items-center justify-center overflow-hidden text-center"
                        >
                            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-bl-[100%] -mr-10 -mt-10 transition-transform duration-700 ease-out group-hover:scale-150"></div>
                            <div className="absolute bottom-0 left-0 w-24 h-24 bg-emerald-500/5 rounded-tr-[100%] -ml-10 -mb-10 transition-transform duration-700 ease-out group-hover:scale-125 opacity-0 group-hover:opacity-100"></div>

                            <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center mb-3 text-white group-hover:scale-110 group-hover:-rotate-6 transition-transform duration-300 shadow-lg shadow-emerald-500/30 ring-4 ring-white z-10">
                                <List className="w-6 h-6 md:w-7 md:h-7 drop-shadow-md" />
                            </div>

                            <h3 className="text-lg md:text-2xl font-bold text-slate-800 mb-1 group-hover:text-slate-900 tracking-tight uppercase z-10">Minhas Viagens</h3>
                            <p className="text-[10px] md:text-xs font-bold text-slate-400 group-hover:text-emerald-600 transition-colors uppercase tracking-widest text-center px-4 z-10">Visualizar histórico e andamentos</p>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
