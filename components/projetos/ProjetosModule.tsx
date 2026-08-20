import React, { useState } from 'react';
import { User, AppState, Person, Sector, Projeto } from '../../types';
import { ProjetosList } from './ProjetosList';
import { ProjetoForm } from './ProjetoForm';
import { ProjetoDetails } from './ProjetoDetails';

export interface ProjetosModuleProps {
    currentView: string;
    subView?: string;
    selectedProjetoId?: string | null;
    userRole: string;
    userName: string;
    userId: string;
    users: User[];
    persons: Person[];
    sectors: Sector[];
    appState: AppState;
    onNavigate: (view: string, id?: string) => void;
    onLogout: () => void;
    onBack?: () => void;
}

export const ProjetosModule: React.FC<ProjetosModuleProps> = ({
    currentView,
    subView,
    selectedProjetoId: propSelectedId,
    userRole,
    userName,
    userId,
    users,
    persons,
    sectors,
    appState,
    onNavigate,
    onLogout,
    onBack
}) => {
    const [internalSelectedId, setInternalSelectedId] = useState<string | null>(null);
    const selectedId = propSelectedId !== undefined ? propSelectedId : internalSelectedId;

    const currentUserSector = users.find(u => u.id === userId)?.sectorId || sectors.find(s => s.name === users.find(u => u.id === userId)?.sector)?.id;

    const navigateTo = (view: 'list' | 'new' | 'details', projetoId?: string) => {
        if (view === 'list') {
            onNavigate('list');
            setInternalSelectedId(null);
        } else if (view === 'new') {
            onNavigate('new');
            setInternalSelectedId(null);
        } else if (view === 'details') {
            setInternalSelectedId(projetoId || null);
            onNavigate('details', projetoId);
        }
    };

    return (
        <div className="flex-1 w-full bg-slate-50 relative min-h-screen">
            {(!subView || subView === 'list' || (subView === 'details' && !selectedId)) && (
                <ProjetosList
                    userId={userId}
                    userRole={userRole}
                    currentUserSector={currentUserSector}
                    users={users}
                    sectors={sectors}
                    onNew={() => navigateTo('new')}
                    onViewProjeto={(id: string) => navigateTo('details', id)}
                    onBack={onBack}
                />
            )}

            {subView === 'new' && (
                <ProjetoForm
                    userId={userId}
                    users={users}
                    sectors={sectors}
                    onSave={() => navigateTo('list')}
                    onCancel={() => navigateTo('list')}
                />
            )}

            {subView === 'details' && selectedId && (
                <ProjetoDetails
                    projetoId={selectedId}
                    userId={userId}
                    userRole={userRole}
                    currentUserSector={currentUserSector}
                    users={users}
                    sectors={sectors}
                    onBack={() => navigateTo('list')}
                />
            )}
        </div>
    );
};
