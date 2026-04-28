import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { User, Person, Sector, AppState } from '../../types';
import { MarketingDashboard } from './MarketingDashboard';
import { NovoConteudoStepper } from './NovoConteudoStepper';
import { MeusConteudosList } from './MeusConteudosList';
import { MarketingDetails } from './MarketingDetails';
import { MarketingOnboarding } from './MarketingOnboarding';
import { supabase } from '../../services/supabaseClient';
import { marketingSyncService } from '../../services/marketingSyncService';
import { birthdaySyncService } from '../../services/birthdaySyncService';
import { HelpCircle } from 'lucide-react';

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
    lastRefresh?: number;
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
    onNavigate,
    lastRefresh
}) => {
    const [hasSeenTour, setHasSeenTour] = React.useState<boolean>(true); // Default to true to avoid flash
    const [isTourOpen, setIsTourOpen] = React.useState(false);
    const [tourStepperIndex, setTourStepperIndex] = React.useState(0);
    const [firstRequestId, setFirstRequestId] = React.useState<string | undefined>(undefined);

    // Filter out the "TESTE" user for everyone except "Administrador"
    const isStrictAdmin = userRole?.toLowerCase() === 'admin' || userRole?.toLowerCase() === 'administrador';
    const isMarketing = userRole?.toLowerCase() === 'marketing';

    React.useEffect(() => {
        const checkTourStatus = async () => {
            const { data } = await supabase
                .from('profiles')
                .select('has_seen_marketing_tour')
                .eq('id', userId)
                .single();
            
            if (data && !data.has_seen_marketing_tour) {
                setHasSeenTour(false);
                setIsTourOpen(true);
            }
        };
        checkTourStatus();

        // 🔹 Sincronização Automática
        const runAutoSync = async () => {
            if (isStrictAdmin || isMarketing) {
                // weekly marketing report sync
                await marketingSyncService.syncWeeklyBirthdays(userId, userName);
                
                // bulk calendar birthday sync (for existing and new records)
                await birthdaySyncService.bulkSyncBirthdays();
            }
        };
        runAutoSync();
    }, [userId, isStrictAdmin, isMarketing]);

    const handleCompleteTour = async () => {
        setIsTourOpen(false);
        setHasSeenTour(true);
        await supabase
            .from('profiles')
            .update({ has_seen_marketing_tour: true })
            .eq('id', userId);
    };
    
    const filteredUsers = isStrictAdmin 
        ? users 
        : users.filter(u => u.name?.toUpperCase() !== 'TESTE' && u.id !== '5cc4a14a-6516-4aaa-8878-623d58c3be3b');

    return (
        <div className="flex-1 flex flex-col h-full bg-[#f8fafc] w-full overflow-hidden animate-in fade-in zoom-in-95 duration-300">
            {/* Conditional Rendering Based on subView */}
            {!subView && (
                <MarketingDashboard
                    onNavigate={onNavigate}
                    onBack={onBack}
                    userId={userId}
                    userRole={userRole}
                />
            )}

            {/* Help Button - Triggers Tour */}
            {!isTourOpen && (
                <button 
                    onClick={() => setIsTourOpen(true)}
                    className="fixed bottom-6 right-6 z-[100] w-12 h-12 rounded-full bg-white shadow-lg border border-indigo-100 flex items-center justify-center text-indigo-600 hover:bg-indigo-600 hover:text-white hover:-translate-y-1 transition-all group lg:w-32 lg:rounded-2xl lg:gap-2 lg:px-4"
                    title="Manual de Instruções"
                >
                    <HelpCircle className="w-6 h-6" />
                    <span className="hidden lg:inline text-[10px] font-black uppercase tracking-widest">Aprender</span>
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-indigo-500 rounded-full animate-ping opacity-75"></div>
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-indigo-500 rounded-full"></div>
                </button>
            )}

            {subView === 'new' && (
                <NovoConteudoStepper
                    onNavigate={onNavigate}
                    onBack={() => onNavigate('')}
                    userId={userId}
                    userName={userName}
                    sectors={sectors}
                    activeStep={tourStepperIndex}
                />
            )}

            {subView === 'list' && (
                <MeusConteudosList 
                    userId={userId} 
                    userRole={userRole} 
                    onOpenDetails={(id) => onNavigate('details', id)} 
                    onLoaded={(id) => setFirstRequestId(id)}
                    lastRefresh={lastRefresh}
                    onBack={() => onNavigate('')}
                />
            )}

            {subView === 'details' && selectedRequestId && (
                <MarketingDetails
                    requestId={selectedRequestId}
                    userRole={userRole}
                    userId={userId}
                    userName={userName}
                    users={filteredUsers}
                    onBack={() => onNavigate('')}
                    activeTab={tourStepperIndex}
                />
            )}

            <MarketingOnboarding 
                isOpen={isTourOpen}
                onClose={() => setIsTourOpen(false)}
                onComplete={handleCompleteTour}
                currentView={subView || 'dashboard'}
                onNavigate={onNavigate}
                stepperIndex={tourStepperIndex}
                onSetStepperIndex={setTourStepperIndex}
                firstRequestId={firstRequestId}
            />
        </div>
    );
};
