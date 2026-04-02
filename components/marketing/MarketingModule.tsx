import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { User, Person, Sector, AppState } from '../../types';
import { MarketingDashboard } from './MarketingDashboard';
import { NovoConteudoStepper } from './NovoConteudoStepper';
import { MeusConteudosList } from './MeusConteudosList';
import { MarketingDetails } from './MarketingDetails';

interface MarketingModuleProps {
    currentView: string;
    userId: string;
    userName: string;
    userRole: string;
    users: User[];
    persons: Person[];
    sectors: Sector[];
    appState: AppState;
    onLogout: () => void;
    onBack: () => void;
    subView?: string;
    selectedRequestId?: string;
    onNavigate: (view: string, id?: string) => void;
}

export const MarketingModule: React.FC<MarketingModuleProps> = ({
    userId,
    userName,
    userRole,
    users,
    persons,
    sectors,
    appState,
    onLogout,
    onBack,
    subView,
    selectedRequestId,
    onNavigate
}) => {
    return (
        <div className="flex-1 flex flex-col h-full bg-[#f8fafc] w-full overflow-hidden animate-in fade-in zoom-in-95 duration-300">
            {/* Conditional Rendering Based on subView */}
            {!subView && (
                <MarketingDashboard
                    onNavigate={onNavigate}
                    onBack={onBack}
                    userId={userId}
                />
            )}

            {subView === 'new' && (
                <NovoConteudoStepper
                    onNavigate={onNavigate}
                    onBack={() => onNavigate('')}
                    userId={userId}
                    userName={userName}
                    sectors={sectors}
                />
            )}

            {subView === 'list' && (
                <div className="flex-1 overflow-hidden flex flex-col bg-white">
                    <header className="bg-white border-b border-slate-200 px-4 md:px-6 py-3 flex items-center justify-between shrink-0 shadow-sm z-10 w-full mb-4 md:mb-6">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => onNavigate('')}
                                className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 transition-all border border-slate-200"
                            >
                                <ArrowLeft className="w-5 h-5" />
                            </button>
                            <div>
                                <h1 className="text-2xl font-black text-slate-800 tracking-tight">Meus Conteúdos</h1>
                                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Histórico de Solicitações</p>
                            </div>
                        </div>
                    </header>
                    <div className="flex-1 overflow-hidden p-4 md:p-6 bg-[#f8fafc]">
                        <div className="max-w-6xl mx-auto bg-white rounded-[2rem] border border-slate-200 shadow-xl overflow-hidden min-h-[500px] flex flex-col relative h-full">
                            <MeusConteudosList userId={userId} onOpenDetails={(id) => onNavigate('details', id)} />
                        </div>
                    </div>
                </div>
            )}

            {subView === 'details' && selectedRequestId && (
                <MarketingDetails
                    requestId={selectedRequestId}
                    userRole={userRole}
                    onBack={() => onNavigate('')}
                />
            )}
        </div>
    );
};
