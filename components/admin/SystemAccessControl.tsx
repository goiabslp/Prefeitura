import React from 'react';
import { ArrowLeft, Shield } from 'lucide-react';
import { User } from '../../types';
import { useSystemSettings } from '../../contexts/SystemSettingsContext';
import { GlobalLoading } from '../common/GlobalLoading';
import { ModuleAccessControlTree } from './ModuleAccessControlTree';

interface SystemAccessControlProps {
  onBack?: () => void;
  users?: User[];
  onBatchUpdateUserPermissions?: (key: string, enabled: boolean) => Promise<{ count: number }>;
}

export const SystemAccessControl: React.FC<SystemAccessControlProps> = ({
  onBack,
  users,
  onBatchUpdateUserPermissions
}) => {
  const { moduleStatus, mobileModuleStatus, toggleModule, isLoading } = useSystemSettings();

  if (isLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-slate-50/50 backdrop-blur-sm z-50">
        <GlobalLoading type="inline" message="Sincronizando permissões globais..." />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#f8fafc] w-full overflow-hidden font-sans">
      {/* Conteúdo Principal com a Árvore Canônica de Controle de Acesso */}
      <main className="flex-1 overflow-y-auto custom-scrollbar p-5 md:p-8">
        <div className="max-w-6xl mx-auto">
          <ModuleAccessControlTree
            onBack={onBack}
            scope="global"
            title="Controle de Acesso Global"
            subtitle="As permissões configuradas abaixo definem a disponibilidade geral dos módulos para todos os usuários do município."
            globalStatus={moduleStatus}
            mobileGlobalStatus={mobileModuleStatus}
            onToggleGlobalStatus={toggleModule}
            users={users}
            onBatchUpdateUserPermissions={onBatchUpdateUserPermissions}
            isLoading={isLoading}
          />
        </div>
      </main>
    </div>
  );
};
