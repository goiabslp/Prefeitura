
import React from 'react';
import {
  Settings,
  LogOut,
  User as UserIcon,
  ChevronDown,
  FileText,
  Home,
  RefreshCw,
  Bell,
  MessageCircle,
  ShieldCheck,
  ShieldOff
} from 'lucide-react';
import { User, UIConfig, BlockType } from '../types';
import { useNotification } from '../contexts/NotificationContext';
import { useChat } from '../contexts/ChatContext';
import { NotificationCenter } from './NotificationCenter';
import { SyncIndicator } from './SyncIndicator';
import { useState } from 'react';
import { getCachedImage, IMAGE_KEYS } from '../services/cacheService';

interface AppHeaderProps {
  currentUser: User;
  uiConfig: UIConfig;
  activeBlock: BlockType | null;
  onLogout: () => void;
  onOpenAdmin: (tab?: string | null) => void;
  onGoHome: () => void;
  currentView: string;
  onRefresh: (silent?: boolean, scope?: string) => void;
  isRefreshing: boolean;
  currentSubView?: string;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  currentUser,
  uiConfig,
  activeBlock,
  onLogout,
  onOpenAdmin,
  onGoHome,
  currentView,
  onRefresh,
  isRefreshing,
  currentSubView
}) => {
  const isAdmin = currentUser.role === 'admin';
  const isNotHome = currentView !== 'home';

  const handleSmartRefresh = () => {
    let scope = 'transactions'; // Default fallback

    if (currentView === 'tracking') {
      if (activeBlock === 'compras') scope = 'compras';
      else if (activeBlock === 'licitacao') scope = 'licitacao';
      else if (activeBlock === 'diarias') scope = 'diarias';
      else if (activeBlock === 'oficio') scope = 'oficio';
    } else if (currentView === 'vehicle-scheduling') {
      scope = 'vehicle-scheduling';
    } else if (currentView === 'abastecimento') {
      scope = 'abastecimento';
    } else if (currentView === 'marketing') {
      scope = 'marketing';
    } else if (currentView === 'rh') {
      scope = 'rh';
    } else if (currentView === 'agricultura') {
      scope = 'agriculture';
    } else if (currentView === 'obras') {
      scope = 'obras';
    } else if (currentView === 'projetos') {
      scope = 'projetos';
    } else if (currentView === 'calendario') {
      scope = 'calendar';
    } else if (currentView === 'admin' || currentView === 'purchase-management') {
      scope = 'transactions';
    } else if (currentView === 'home') {
      scope = 'metadata'; // Or 'transactions' depending on what home shows
    }

    onRefresh(false, scope);
  };

  const getModuleTitle = () => {
    if (currentView === 'admin') return "Painel Administrativo";
    if (currentView === 'order-details') return "Detalhes do Pedido";
    if (currentView === 'tracking') {
      if (activeBlock === 'licitacao') return "Histórico de Processos";
      if (activeBlock === 'oficio') return "Histórico de Ofícios";
      if (activeBlock === 'compras') return "Histórico de Compras";
      if (activeBlock === 'diarias') return "Histórico de Diárias";
      return `Histórico: ${activeBlock?.toUpperCase()}`;
    }
    if (currentView === 'vehicle-scheduling') {
      if (activeBlock === 'vs_calendar') return "Novo Agendamento";
      if (activeBlock === 'vs_history') return "Histórico de Agendamento de Veículos";
      if (activeBlock === 'vs_approvals') return "Aprovações de Agendamento de Veículos";
      return "Módulo Agendamento de Veículos";
    }
    if (currentView === 'editor') {
      if (activeBlock === 'oficio') return "Novo Ofício";
      if (activeBlock === 'compras') return "Novo Pedido de Compras";
      if (activeBlock === 'diarias') return "Nova Solicitação de Diárias";
      return "Novo Registro";
    }
    if (currentView === 'purchase-management') return "Pedidos de Compras";
    if (currentView === 'abastecimento') {
      if (currentSubView === 'new') return "Novo Abastecimento";
      if (currentSubView === 'management') return "Gestão de Abastecimento";
      if (currentSubView === 'dashboard') return "Dashboard de Abastecimento";
      return "Módulo de Abastecimento";
    }

    if (activeBlock === 'tarefas') {
      if (currentSubView === 'new') return "Nova Tarefa";
      if (currentSubView === 'dashboard') return "Minhas Tarefas";
      return "Gestão de Tarefas";
    }

    switch (activeBlock) {
      case 'oficio': return "Módulo de Ofícios";
      case 'compras': return "Módulo de Compras";
      case 'licitacao': return "Módulo de Licitação";
      case 'diarias': return "Módulo de Diárias";
      case 'abastecimento': return "Módulo de Abastecimento";
      case 'tarefas' as any: return "Gestão de Tarefas";
      default: return "Página Inicial";
    }
  };

  const NotificationBell = () => {
    const { unreadCount } = useNotification();
    const [isOpen, setIsOpen] = useState(false);

    return (
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`relative p-2 rounded-xl transition-all active:scale-95 group
            ${isOpen ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:bg-slate-50 hover:text-indigo-600'}
          `}
          title="Notificações"
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-rose-500 border-2 border-white rounded-full animate-pulse shadow-sm"></span>
          )}
        </button>

        <NotificationCenter isOpen={isOpen} onClose={() => setIsOpen(false)} />
      </div>
    );
  };

  const ChatIcon = () => {
    const { unreadCount, setIsOpen, isOpen } = useChat();

    return (
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-2 rounded-xl transition-all active:scale-95 group
            ${isOpen ? 'bg-violet-50 text-violet-600' : 'text-slate-400 hover:bg-slate-50 hover:text-violet-600'}
          `}
        title="Chat"
      >
        <MessageCircle className={`w-5 h-5 ${unreadCount > 0 ? 'animate-pulse text-violet-600' : ''}`} />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-violet-500 border-2 border-white rounded-full shadow-sm animate-bounce"></span>
        )}
      </button>
    );
  };

  const TwoFactorStatus = () => {
    const isEnabled = currentUser.twoFactorEnabled;

    return (
      <button
        onClick={() => onOpenAdmin('2fa')}
        className={`relative p-2 rounded-xl transition-all active:scale-95 group
            ${isEnabled ? 'text-emerald-500 hover:bg-emerald-50' : 'text-rose-400 hover:bg-rose-50 hover:text-rose-600'}
          `}
        title={isEnabled ? "2FA Ativado" : "2FA Desativado - Clique para configurar"}
      >
        {isEnabled ? (
          <ShieldCheck className="w-5 h-5" />
        ) : (
          <ShieldOff className="w-5 h-5" />
        )}
        {!isEnabled && (
          <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-rose-500 border-2 border-white rounded-full shadow-sm animate-pulse opacity-0 group-hover:opacity-100 transition-opacity"></span>
        )}
      </button>
    );
  };

  const { unreadCount, setIsOpen, isOpen } = useChat();

  return (
    <header className={`sticky top-0 z-[60] w-full border-b shrink-0 transition-all duration-500 ease-in-out
      ${unreadCount > 0
        ? 'bg-violet-50/30 border-violet-200 shadow-[0_4px_30px_rgba(139,92,246,0.3)] animate-pulse-glow'
        : 'bg-white/80 backdrop-blur-md border-slate-200'
      }
    `}>
      <div className="max-w-[1920px] mx-auto px-6 h-16 flex items-center justify-between">

        {/* Lado Esquerdo: Logo e Título */}
        <div className="flex items-center gap-6">
          <button
            onClick={onGoHome}
            className="flex items-center gap-3 hover:opacity-80 transition-all active:scale-95 group"
            title="Ir para o Início"
          >
            {uiConfig.headerLogoUrl ? (
              <img
                src={getCachedImage(uiConfig.headerLogoUrl, IMAGE_KEYS.headerLogoUrl) || uiConfig.headerLogoUrl}
                alt="Logo"
                style={{ height: `${uiConfig.headerLogoHeight || 32}px` }}
                className="object-contain"
              />
            ) : (
              <div className="p-2 bg-indigo-600 rounded-lg shadow-lg shadow-indigo-500/20 group-hover:bg-indigo-700 transition-colors">
                <FileText className="w-5 h-5 text-white" />
              </div>
            )}
          </button>

          <div className="h-6 w-px bg-slate-200 hidden desktop:block"></div>

          <div className="hidden desktop:flex flex-col">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] leading-none mb-1">Tela Atual</span>
            <span className="text-sm font-bold text-slate-900 tracking-tight">{getModuleTitle()}</span>
          </div>
        </div>

        {/* Internal Style for refined active state */}
        <style dangerouslySetInnerHTML={{
          __html: `
        @keyframes pulse-glow {
          0%, 100% { 
            background-color: rgba(245, 243, 255, 0.4); 
            border-color: rgba(221, 214, 254, 0.5);
            box-shadow: 0 4px 20px rgba(139, 92, 246, 0.15);
          }
          50% { 
            background-color: rgba(237, 233, 254, 0.6); 
            border-color: rgba(167, 139, 250, 0.8);
            box-shadow: 0 10px 40px rgba(139, 92, 246, 0.35);
          }
        }
        .animate-pulse-glow {
          animation: pulse-glow 3s infinite ease-in-out;
        }
      `}} />

        {/* Lado Direito: Ações e Perfil */}
        < div className="flex items-center gap-2 md:gap-4" >

          {/* REFRESH BUTTON */}
          <button
            onClick={handleSmartRefresh}
            disabled={isRefreshing}
            className={`p-2 rounded-xl transition-all active:scale-95 group relative
              ${isRefreshing ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:bg-slate-50 hover:text-indigo-600'}
            `}
            title="Atualizar Dados"
          >
            <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>

          <div className="h-8 w-px bg-slate-200 mx-1 hidden desktop:block"></div>

          {isNotHome && (
            <button
              onClick={onGoHome}
              className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:text-indigo-600 hover:bg-slate-50 text-xs font-bold rounded-xl transition-all active:scale-95"
            >
              <Home className="w-4 h-4" />
              <span className="hidden desktop:inline">Início</span>
            </button>
          )}

          {
            isAdmin && currentView !== 'admin' && (
              <button
                onClick={() => onOpenAdmin(null)}
                className="hidden desktop:flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-indigo-600 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-slate-900/10 active:scale-95"
              >
                <Settings className="w-4 h-4" />
                Administração
              </button>
            )
          }

          <div className="h-8 w-px bg-slate-200 mx-1"></div>

          <div className="flex flex-col items-center gap-0.5 transform translate-y-1">

            <SyncIndicator />
          </div>

          <div className="h-8 w-px bg-slate-200 mx-1"></div>

          {/* Notification Center */}
          <TwoFactorStatus />
          <div className="w-2"></div>
          <ChatIcon />
          <div className="w-2"></div>
          <NotificationBell />

          <div className="flex items-center gap-3 pl-2">
            <div className="hidden lg:flex flex-col items-end">
              <span className="text-xs font-bold text-slate-900 leading-none">{currentUser.name.split(' ')[0]}</span>
              <span className="text-[10px] font-medium text-slate-500 mt-0.5">{currentUser.jobTitle || 'Usuário'}</span>
            </div>

            <div className="relative group">
              <button className="flex items-center gap-1 p-1 rounded-xl hover:bg-slate-100 transition-colors">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-black shadow-sm ${currentUser.role === 'admin' ? 'bg-indigo-600 text-white' :
                  (currentUser.role === 'compras' || currentUser.role === 'licitacao') ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
                  }`}>
                  {currentUser.name.charAt(0)}
                </div>
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </button>

              <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-2xl border border-slate-100 py-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 transform origin-top-right">
                <div className="px-4 py-2 mb-2 border-b border-slate-50">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nível: {currentUser.role}</p>
                </div>
                <button
                  onClick={() => onOpenAdmin('users')}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-indigo-600 transition-colors"
                >
                  <UserIcon className="w-4 h-4" />
                  Meu Perfil
                </button>
                <button
                  onClick={() => onOpenAdmin('2fa')}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-indigo-600 transition-colors"
                >
                  <ShieldCheck className="w-4 h-4" />
                  Autenticador 2FA
                </button>
                <button
                  onClick={onLogout}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Sair
                </button>
              </div>
            </div>
          </div>
        </div >
      </div >
    </header >
  );
};

