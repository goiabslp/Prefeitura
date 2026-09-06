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
      <header className="shrink-0 bg-white border-b border-slate-200 px-6 md:px-8 py-4 flex items-center justify-between z-30 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
        <div className="flex items-center gap-4">
          {onBack && (
            <button
              onClick={onBack}
              type="button"
              className="p-2.5 rounded-2xl bg-slate-100 text-slate-600 hover:bg-slate-900 hover:text-white transition-all active:scale-95 border border-slate-200/60 cursor-pointer"
              title="Voltar"
            >
              <ArrowLeft className="w-5 h-5 transition-transform group-hover:-translate-x-0.5" />
            </button>
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-lg border border-indigo-100">
                /Admin/ControleAcesso
              </span>
            </div>
            <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight mt-0.5">
              Controle de Acesso Global
            </h1>
          </div>
        </div>
      </header>

      {/* Conteúdo Principal com a Árvore Canônica de Controle de Acesso */}
      <main className="flex-1 overflow-y-auto custom-scrollbar p-5 md:p-8">
        <div className="max-w-6xl mx-auto">
          <ModuleAccessControlTree
            scope="global"
            title="Controle Global de Acesso"
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
