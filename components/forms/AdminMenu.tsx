
import React from 'react';
import { Users, User as UserIcon, PenTool, Home, Palette, Briefcase, Network, Truck, ShieldCheck, Shield, RefreshCw, FileText, Tv, Activity } from 'lucide-react';
import { User } from '../../types';

import { userCanAccessSubmodule, userCanAccessModuleParent, MODULE_ACCESS_TREE } from '../../services/permissionService';

interface AdminMenuProps {
  currentUser: User;
  onTabChange: (tab: string) => void;
}

export const AdminMenu: React.FC<AdminMenuProps> = ({ currentUser, onTabChange }) => {
  const canAccessSub = (subKey: string) => {
    return userCanAccessSubmodule(currentUser, 'parent_admin', subKey);
  };

  const adminModules = [
    {
      id: 'users',
      subKey: 'sub_admin_usuarios',
      title: 'Gestão de Usuários',
      description: 'Gerencie acessos e equipe do sistema',
      icon: <Users className="w-6 h-6 text-indigo-600" />,
      colorClass: 'bg-indigo-50 border-indigo-100 hover:border-indigo-300 shadow-sm'
    },
    {
      id: 'entities',
      subKey: 'sub_admin_entidades',
      title: 'Pessoas, Setores e Cargos',
      description: 'Gerencie a base de dados organizacional',
      icon: <Network className="w-6 h-6 text-orange-600" />,
      colorClass: 'bg-orange-50 border-orange-100 hover:border-orange-300 shadow-sm'
    },
    {
      id: 'fleet',
      subKey: 'sub_admin_entidades',
      customCheck: () => {
        const frotasDef = MODULE_ACCESS_TREE.find(m => m.key === 'parent_frotas');
        return canAccessSub('sub_admin_entidades') || (frotasDef ? userCanAccessModuleParent(currentUser, frotasDef) : false);
      },
      title: 'Gestão de Frotas',
      description: 'Veículos leves, pesados e acessórios',
      icon: <Truck className="w-6 h-6 text-blue-600" />,
      colorClass: 'bg-blue-50 border-blue-100 hover:border-blue-300 shadow-sm'
    },
    {
      id: 'egress',
      subKey: 'sub_admin_logs',
      title: 'Monitor de Egress',
      description: 'Telemetria de dados e requisições Supabase',
      icon: <Activity className="w-6 h-6 text-emerald-600" />,
      colorClass: 'bg-emerald-50 border-emerald-100 hover:border-emerald-300 shadow-sm'
    },
    {
      id: 'logs',
      subKey: 'sub_admin_logs',
      title: 'Logs de Auditoria',
      description: 'Monitore ações e cliques dos usuários',
      icon: <FileText className="w-6 h-6 text-slate-600" />,
      colorClass: 'bg-slate-50 border-slate-100 hover:border-slate-300 shadow-sm'
    },
    {
      id: '2fa',
      subKey: 'sub_admin_autenticador',
      title: 'Autenticador 2FA',
      description: 'Segurança em duas etapas',
      icon: <ShieldCheck className="w-6 h-6 text-emerald-600" />,
      colorClass: 'bg-emerald-50 border-emerald-100 hover:border-emerald-300 shadow-sm'
    },
    {
      id: 'remote_access',
      subKey: 'sub_admin_acesso_remoto',
      title: 'Acesso Remoto',
      description: 'Compartilhamento de tela em tempo real',
      icon: <Tv className="w-6 h-6 text-indigo-600" />,
      colorClass: 'bg-indigo-50 border-indigo-100 hover:border-indigo-300 shadow-sm'
    },
    {
      id: 'access_control',
      subKey: 'sub_admin_controle_acesso',
      title: 'Controle de Acesso',
      description: 'Ativar/Desativar módulos globalmente',
      icon: <Shield className="w-6 h-6 text-red-600" />,
      colorClass: 'bg-red-50 border-red-100 hover:border-red-300 shadow-sm'
    },
    {
      id: 'system_update',
      subKey: 'sub_admin_atualizacao',
      title: 'Atualização',
      description: 'Forçar atualização de ambiente',
      icon: <RefreshCw className="w-6 h-6 text-amber-600" />,
      colorClass: 'bg-amber-50 border-amber-100 hover:border-amber-300 shadow-sm'
    },
    {
      id: 'ui',
      subKey: 'sub_admin_interface',
      title: 'Interface',
      description: 'Personalize logos e visual do app',
      icon: <Home className="w-6 h-6 text-blue-600" />,
      colorClass: 'bg-blue-50 border-blue-100 hover:border-blue-300 shadow-sm'
    },
    {
      id: 'design',
      subKey: 'sub_admin_design',
      title: 'Design do documento',
      description: 'Configurações de layout do PDF',
      icon: <Palette className="w-6 h-6 text-purple-600" />,
      colorClass: 'bg-purple-50 border-purple-100 hover:border-purple-300 shadow-sm'
    }
  ].filter(mod => {
    if (mod.customCheck) return mod.customCheck();
    if (mod.subKey) return canAccessSub(mod.subKey);
    return false;
  });


  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {adminModules.map((mod) => (
          <button
            key={mod.id}
            onClick={() => onTabChange(mod.id)}
            className={`p-6 rounded-3xl border-2 text-left transition-all duration-300 hover:scale-[1.02] hover:shadow-xl flex flex-col gap-4 ${mod.colorClass}`}
          >
            <div className="p-3 bg-white rounded-2xl w-fit shadow-md">{mod.icon}</div>
            <div>
              <h3 className="font-black text-slate-900 text-lg leading-tight">{mod.title}</h3>
              <p className="text-xs text-slate-500 mt-1 font-medium opacity-80">{mod.description}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
