import React from 'react';
import { ArrowLeft, Map } from 'lucide-react';

interface MinhasViagensScreenProps {
    onBack: () => void;
}

export const MinhasViagensScreen: React.FC<MinhasViagensScreenProps> = ({ onBack }) => {
    return (
        <div className="flex flex-col flex-1 w-full h-full bg-slate-50 font-sans">
            <div className="p-8 border-b border-slate-200 bg-white shadow-sm flex items-center">
                <button
                    onClick={onBack}
                    className="mr-4 p-2 rounded-full hover:bg-slate-100 transition-colors text-slate-500"
                >
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center mr-4">
                    <Map className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                    <h1 className="text-2xl font-black text-slate-800">Minhas Viagens</h1>
                    <p className="text-slate-500 text-sm font-medium">Histórico e acompanhamento das suas viagens</p>
                </div>
            </div>
            <div className="flex-1 p-8 overflow-y-auto">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 max-w-5xl mx-auto flex items-center justify-center min-h-[400px]">
                    <p className="text-slate-400 font-medium text-lg">Lista de Minhas Viagens em desenvolvimento...</p>
                </div>
            </div>
        </div>
    );
};
