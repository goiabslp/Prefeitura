import React, { useState, useEffect } from 'react';
import { User, AppState, BlockType, Order, RhHorasExtras, Person, Job, Sector } from '../../types';
import { HorasExtrasForm } from './HorasExtrasForm';
import { HorasExtrasHistory } from './HorasExtrasHistory';
import { Users, FileText, ArrowLeft, History, PlusCircle } from 'lucide-react';
import { HorasExtrasPdfGenerator } from './HorasExtrasPdfGenerator';

interface RHModuleProps {
    currentView: string;
    subView?: string;
    userRole: string;
    userName: string;
    userId: string;
    users: User[];
    persons: Person[];
    jobs: Job[];
    sectors: Sector[];
    appState: AppState;
    onNavigate: (view: string) => void;
    onLogout: () => void;
    onSaveForm: (data: any) => void;
}

export const RHModule: React.FC<RHModuleProps> = ({
    currentView,
    subView,
    userRole,
    userName,
    userId,
    users,
    persons,
    jobs,
    sectors,
    appState,
    onNavigate,
    onLogout,
    onSaveForm
}) => {
    const isFormView = subView === 'horas-extras' || subView === 'historico';
    const [activeTab, setActiveTab] = useState<'novo' | 'historico'>(subView === 'historico' ? 'historico' : 'novo');
    const [highlightId, setHighlightId] = useState<string | null>(null);
    const [generatingPdfRecord, setGeneratingPdfRecord] = useState<RhHorasExtras | null>(null);
    const [editingRecord, setEditingRecord] = useState<RhHorasExtras | null>(null);

    useEffect(() => {
        const handleForceHistory = (e: any) => {
            setActiveTab('historico');
            if (e.detail?.id) {
                setHighlightId(e.detail.id);
                // Clear highlight after a few seconds
                setTimeout(() => setHighlightId(null), 5000);
            }
        };
        window.addEventListener('rh-force-historico', handleForceHistory);
        return () => window.removeEventListener('rh-force-historico', handleForceHistory);
    }, []);

    useEffect(() => {
        if (subView === 'historico') {
            setActiveTab('historico');
        } else if (subView === 'horas-extras') {
            setActiveTab('novo');
        }
    }, [subView]);

    const handleDownloadPdf = (record: RhHorasExtras) => {
        setGeneratingPdfRecord(record);
    };

    const handleEdit = (record: RhHorasExtras) => {
        setEditingRecord(record);
        setActiveTab('novo');
    };

    return (
        <div className="flex-1 w-full bg-slate-50 relative">
            {generatingPdfRecord && (
                <HorasExtrasPdfGenerator
                    record={generatingPdfRecord}
                    state={appState}
                    onClose={() => setGeneratingPdfRecord(null)}
                />
            )}
            <div className="flex-1 flex flex-col h-full bg-[#f8fafc] w-full max-w-[100vw] overflow-x-hidden relative">
                <main className="flex-1 overflow-y-auto p-4 desktop:p-8 custom-scrollbar">
                    {!isFormView ? (
                        <div className="flex-1 flex flex-col items-center justify-center w-full h-full min-h-0 container mx-auto">
                            {/* Fixed Back Button - Standardized Position */}
                            <button
                                onClick={() => onNavigate('home')}
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
                                <div className="flex flex-col items-center mb-6 md:mb-12 shrink-0 animation-delay-100 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <div className="p-4 rounded-[1.8rem] bg-gradient-to-br from-fuchsia-50 to-fuchsia-100/50 mb-4 shadow-sm ring-6 ring-white/50">
                                        <Users className="w-10 h-10 text-fuchsia-600 drop-shadow-sm" />
                                    </div>
                                    <h2 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight text-center drop-shadow-sm uppercase">Recursos Humanos</h2>
                                    <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.2em] mt-1 text-center">Gerencie lançamentos e horas extras da equipe</p>
                                </div>

                                {/* Quick Actions / Cards */}
                                <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6 max-w-4xl animate-in zoom-in duration-500 fill-mode-backwards p-2">
                                    {/* Card Horas Extras */}
                                    <button
                                        onClick={() => onNavigate('rh:horas-extras')}
                                        className={`group relative w-full min-h-[140px] md:min-h-[180px] rounded-[2.5rem] bg-gradient-to-br from-white to-slate-50/50 border border-slate-100 shadow-[0_10px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_25px_60px_rgb(0,0,0,0.12)] hover:shadow-fuchsia-500/30 hover:border-fuchsia-200 hover:from-white hover:to-fuchsia-50/30 transition-all duration-300 ease-spring hover:-translate-y-2 active:scale-95 flex flex-col items-center justify-center overflow-hidden text-center`}
                                        style={{ animationDelay: `0ms` }}
                                    >
                                        <div className={`absolute top-0 right-0 w-32 h-32 bg-fuchsia-500/5 rounded-bl-[100%] -mr-10 -mt-10 transition-transform duration-700 ease-out group-hover:scale-150`}></div>
                                        <div className={`absolute bottom-0 left-0 w-24 h-24 bg-fuchsia-500/5 rounded-tr-[100%] -ml-10 -mb-10 transition-transform duration-700 ease-out group-hover:scale-125 opacity-0 group-hover:opacity-100`}></div>

                                        <div className={`w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-gradient-to-br from-fuchsia-500 to-fuchsia-600 flex items-center justify-center mb-3 text-white group-hover:scale-110 group-hover:rotate-6 transition-transform duration-300 shadow-lg shadow-fuchsia-500/30 ring-4 ring-white`}>
                                            <PlusCircle className="w-6 h-6 md:w-7 md:h-7 drop-shadow-md" />
                                        </div>

                                        <h3 className="text-lg md:text-2xl font-bold text-slate-800 mb-1 group-hover:text-slate-900 tracking-tight uppercase">Novo Lançamento</h3>
                                        <p className="text-[10px] md:text-xs font-bold text-slate-400 group-hover:text-fuchsia-600 transition-colors uppercase tracking-widest text-center px-4">Horas Extras</p>
                                    </button>

                                    {/* Card Historico */}
                                    <button
                                        onClick={() => onNavigate('rh:historico')}
                                        className={`group relative w-full min-h-[140px] md:min-h-[180px] rounded-[2.5rem] bg-gradient-to-br from-white to-slate-50/50 border border-slate-100 shadow-[0_10px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_25px_60px_rgb(0,0,0,0.12)] hover:shadow-indigo-500/30 hover:border-indigo-200 hover:from-white hover:to-indigo-50/30 transition-all duration-300 ease-spring hover:-translate-y-2 active:scale-95 flex flex-col items-center justify-center overflow-hidden text-center`}
                                        style={{ animationDelay: `100ms` }}
                                    >
                                        <div className={`absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-bl-[100%] -mr-10 -mt-10 transition-transform duration-700 ease-out group-hover:scale-150`}></div>
                                        <div className={`absolute bottom-0 left-0 w-24 h-24 bg-indigo-500/5 rounded-tr-[100%] -ml-10 -mb-10 transition-transform duration-700 ease-out group-hover:scale-125 opacity-0 group-hover:opacity-100`}></div>

                                        <div className={`w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center mb-3 text-white group-hover:scale-110 group-hover:rotate-6 transition-transform duration-300 shadow-lg shadow-indigo-500/30 ring-4 ring-white`}>
                                            <History className="w-6 h-6 md:w-7 md:h-7 drop-shadow-md" />
                                        </div>

                                        <h3 className="text-lg md:text-2xl font-bold text-slate-800 mb-1 group-hover:text-slate-900 tracking-tight uppercase">Histórico</h3>
                                        <p className="text-[10px] md:text-xs font-bold text-slate-400 group-hover:text-indigo-600 transition-colors uppercase tracking-widest text-center px-4">Planilhas Fechadas</p>
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="max-w-7xl mx-auto w-full">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                                <button
                                    onClick={() => onNavigate('rh')}
                                    className="flex items-center gap-2 text-slate-500 hover:text-fuchsia-600 font-bold transition-colors group w-fit"
                                >
                                    <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                                    Voltar ao Painel
                                </button>
                            </div>

                            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                                {activeTab === 'novo' ? (
                                    <HorasExtrasForm
                                        users={users}
                                        persons={persons}
                                        jobs={jobs}
                                        sectors={sectors}
                                        userRole={userRole}
                                        currentUserId={userId}
                                        editingRecord={editingRecord}
                                        onSave={(data) => {
                                            onSaveForm(data);
                                            setEditingRecord(null);
                                        }}
                                        onCancel={() => {
                                            if (editingRecord) {
                                                setEditingRecord(null);
                                                setActiveTab('historico');
                                            } else {
                                                onNavigate('rh');
                                            }
                                        }}
                                        appState={appState}
                                    />
                                ) : (
                                    <HorasExtrasHistory
                                        userRole={userRole}
                                        currentUserSector={userRole === 'admin' ? 'Geral' : (users.find(u => u.id === userId)?.sector || 'Geral')}
                                        onDownloadPdf={handleDownloadPdf}
                                        onEdit={handleEdit}
                                    />
                                )}
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};
