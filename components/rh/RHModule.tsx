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
    const isFormView = subView === 'horas-extras';
    const [activeTab, setActiveTab] = useState<'novo' | 'historico'>('novo');
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

    const handleDownloadPdf = (record: RhHorasExtras) => {
        setGeneratingPdfRecord(record);
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
                        <div className="max-w-7xl mx-auto w-full animate-fade-in">
                            {/* Header Area */}
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                                <div>
                                    <h1 className="text-3xl desktop:text-4xl font-extrabold text-slate-900 tracking-tight">Painel RH</h1>
                                    <p className="text-slate-500 font-medium text-lg mt-1">Gerencie lançamentos e horas extras da equipe.</p>
                                </div>
                            </div>

                            {/* Quick Actions / Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                                {/* Card Horas Extras */}
                                <button
                                    onClick={() => onNavigate('rh:horas-extras')}
                                    className="group relative flex flex-col items-center justify-center p-8 bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 text-left overflow-hidden h-64"
                                >
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-fuchsia-500/5 rounded-bl-[100%] -mr-10 -mt-10 transition-transform duration-700 ease-out group-hover:scale-150"></div>
                                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-fuchsia-500 to-indigo-600 text-white flex items-center justify-center mb-6 shadow-lg shadow-fuchsia-500/30 group-hover:scale-110 transition-transform duration-300">
                                        <FileText className="w-8 h-8" />
                                    </div>
                                    <h3 className="text-xl font-bold text-slate-800 mb-2">Lançamento de Horas Extras</h3>
                                    <p className="text-slate-500 text-sm text-center max-w-[200px]">Registre as horas extras mensais dos colaboradores do seu setor.</p>
                                </button>

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

                                {/* Tabs Navigation */}
                                <div className="flex bg-slate-200/50 p-1 rounded-xl w-fit">
                                    <button
                                        onClick={() => setActiveTab('novo')}
                                        className={`flex items-center gap-2.5 px-6 py-3 rounded-xl text-sm font-black uppercase tracking-widest transition-all ${activeTab === 'novo'
                                            ? 'bg-white text-indigo-700 shadow-sm'
                                            : 'text-slate-600 hover:text-indigo-600 hover:bg-slate-100/50'
                                            }`}
                                    >
                                        <PlusCircle className="h-4 w-4" />
                                        Novo Lançamento
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('historico')}
                                        className={`flex items-center gap-2.5 px-6 py-3 rounded-xl text-sm font-black uppercase tracking-widest transition-all ${activeTab === 'historico'
                                            ? 'bg-white text-indigo-700 shadow-sm'
                                            : 'text-slate-600 hover:text-indigo-600 hover:bg-slate-100/50'
                                            }`}
                                    >
                                        <History className="h-4 w-4" />
                                        Histórico
                                    </button>
                                </div>
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
                                            setEditingRecord(null);
                                            onNavigate('rh');
                                        }}
                                        appState={appState}
                                    />
                                ) : (
                                    <HorasExtrasHistory
                                        userRole={userRole}
                                        currentUserSector={userRole === 'admin' ? 'Geral' : (users.find(u => u.id === userId)?.sector || 'Geral')}
                                        onDownloadPdf={handleDownloadPdf}
                                        onEdit={(record) => {
                                            setEditingRecord(record);
                                            setActiveTab('novo');
                                        }}
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
