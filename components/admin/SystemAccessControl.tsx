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
      {/* Barra de Navegação Superior */}
      {onBack && (
        <header className="shrink-0 bg-white border-b border-slate-200 px-6 md:px-8 py-3.5 flex items-center justify-between z-30 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
          <button
            onClick={onBack}
            type="button"
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-900 hover:text-white transition-all active:scale-95 border border-slate-200/60 cursor-pointer text-xs font-bold group"
            title="Voltar ao Painel"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
            <span>Voltar ao Painel</span>
          </button>
        </header>
      )}

      {/* Conteúdo Principal com a Árvore Canônica de Controle de Acesso */}
      <main className="flex-1 overflow-y-auto custom-scrollbar p-5 md:p-8">
        <div className="max-w-6xl mx-auto">
          <ModuleAccessControlTree
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
