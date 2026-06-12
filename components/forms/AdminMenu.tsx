
import React from 'react';
import { Users, User as UserIcon, PenTool, Home, Palette, Briefcase, Network, Truck, ShieldCheck, Shield, RefreshCw, FileText } from 'lucide-react';
import { User } from '../../types';

interface AdminMenuProps {
  currentUser: User;
  onTabChange: (tab: string) => void;
}

export const AdminMenu: React.FC<AdminMenuProps> = ({ currentUser, onTabChange }) => {
  const isAdmin = currentUser.role === 'admin' || currentUser.permissions.includes('parent_admin');

  const adminModules = [
    {
      id: 'users',
      title: isAdmin ? 'Gestão de Usuários' : 'Meu Perfil',
      description: isAdmin ? 'Gerencie acessos e equipe do sistema' : 'Configure seus dados de acesso',
      icon: isAdmin ? <Users className="w-6 h-6 text-indigo-600" /> : <UserIcon className="w-6 h-6 text-indigo-600" />,
      colorClass: 'bg-indigo-50 border-indigo-100 hover:border-indigo-300 shadow-sm'
    },
    {
      id: 'entities',
      title: 'Pessoas, Setores e Cargos',
      description: 'Gerencie a base de dados organizacional',
      icon: <Network className="w-6 h-6 text-orange-600" />,
      colorClass: 'bg-orange-50 border-orange-100 hover:border-orange-300 shadow-sm',
      adminOnly: true
    },
    {
      id: 'fleet',
      title: 'Gestão de Frotas',
      description: 'Veículos leves, pesados e acessórios',
      icon: <Truck className="w-6 h-6 text-blue-600" />,
      colorClass: 'bg-blue-50 border-blue-100 hover:border-blue-300 shadow-sm',
      adminOnly: true
    },
    {
      id: 'logs',
      title: 'Logs de Auditoria',
      description: 'Monitore ações e cliques dos usuários',
      icon: <FileText className="w-6 h-6 text-slate-600" />,
      colorClass: 'bg-slate-50 border-slate-100 hover:border-slate-300 shadow-sm',
      adminOnly: true
    },
    {
      id: '2fa',
      title: 'Autenticador 2FA',
      description: 'Segurança em duas etapas',
      icon: <ShieldCheck className="w-6 h-6 text-emerald-600" />,
      colorClass: 'bg-emerald-50 border-emerald-100 hover:border-emerald-300 shadow-sm',
      adminOnly: false // All users should be able to configure their own 2FA
    },
    {
      id: 'access_control',
      title: 'Controle de Acesso',
      description: 'Ativar/Desativar módulos globalmente',
      icon: <Shield className="w-6 h-6 text-red-600" />,
      colorClass: 'bg-red-50 border-red-100 hover:border-red-300 shadow-sm',
      adminOnly: true
    },
    {
      id: 'system_update',
      title: 'Atualização',
      description: 'Forçar atualização de ambiente',
      icon: <RefreshCw className="w-6 h-6 text-amber-600" />,
      colorClass: 'bg-amber-50 border-amber-100 hover:border-amber-300 shadow-sm',
      adminOnly: true
    },

    {
      id: 'ui',
      title: 'Interface',
      description: 'Personalize logos e visual do app',
      icon: <Home className="w-6 h-6 text-blue-600" />,
      colorClass: 'bg-blue-50 border-blue-100 hover:border-blue-300 shadow-sm',
      adminOnly: true
    },
    {
      id: 'design',
      title: 'Design do documento',
      description: 'Configurações de layout do PDF',
      icon: <Palette className="w-6 h-6 text-purple-600" />,
      colorClass: 'bg-purple-50 border-purple-100 hover:border-purple-300 shadow-sm',
      adminOnly: true
    }
  ].filter(mod => !mod.adminOnly || isAdmin);

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
