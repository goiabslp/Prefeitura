import React from 'react';
import { User, AutoSenhaUnidadeId } from '../../types';
import { AutoSenhaHomeScreen } from './AutoSenhaHomeScreen';
import { AutoSenhaPostoScreen } from './AutoSenhaPostoScreen';
import { AutoSenhaControleScreen } from './AutoSenhaControleScreen';
import { SenhaTVScreen } from './SenhaTVScreen';
import { AutoSenhaDashboardScreen } from './AutoSenhaDashboardScreen';
import { PacientesHubScreen } from '../consultas/pacientes/PacientesHubScreen';

interface AutoSenhaModuleProps {
  currentView: string;
  subView?: string;
  currentUser?: User | null;
  onNavigate: (viewKey: string) => void;
}

export const AutoSenhaModule: React.FC<AutoSenhaModuleProps> = ({
  currentView,
  subView,
  currentUser,
  onNavigate
}) => {
  // A rota determina automaticamente a unidade e a tela ativa
  // subView pode ser:
  // undefined | 'home' -> /AutoSenha
  // 'dashboard' -> /AutoSenha/Dashboard
  // 'pacientes' -> /AutoSenha/Pacientes
  // 'psf1' -> /AutoSenha/PSF1
  // 'psf1-controle' -> /AutoSenha/PSF1/Controle
  // 'psf1-senhatv' -> /AutoSenha/PSF1/SenhaTV
  // 'psf2' -> /AutoSenha/PSF2
  // 'psf2-controle' -> /AutoSenha/PSF2/Controle
  // 'psf2-senhatv' -> /AutoSenha/PSF2/SenhaTV
  // 'upa' -> /AutoSenha/UPA
  // 'upa-controle' -> /AutoSenha/UPA/Controle
  // 'upa-senhatv' -> /AutoSenha/UPA/SenhaTV

  // Renderizador com wrapper 100% de viewport
  return (
    <div className="w-full flex-1 min-w-0 h-[calc(100vh-68px)] max-h-[calc(100vh-68px)] flex flex-col overflow-hidden bg-slate-50">
      {/* 1. Central Integrada de Pacientes (/AutoSenha/Pacientes) */}
      {subView === 'pacientes' && (
        <PacientesHubScreen
          currentUser={currentUser}
          onBack={() => onNavigate('autosenha')}
          baseRoute="/AutoSenha/Pacientes"
        />
      )}

      {/* 2. Dashboard Administrativo Centralizado (/AutoSenha/Dashboard, /AutoSenha/Dashboard/Capacidade, /AutoSenha/Dashboard/Auditoria) */}
      {(subView === 'dashboard' || subView === 'dashboard-capacidade' || subView === 'dashboard-auditoria') && (
        <AutoSenhaDashboardScreen
          currentUser={currentUser}
          initialAba={
            subView === 'dashboard-capacidade'
              ? 'capacidade'
              : subView === 'dashboard-auditoria'
              ? 'auditoria'
              : 'operacional'
          }
          onChangeAba={(aba) => {
            if (aba === 'capacidade') onNavigate('autosenha:dashboard-capacidade');
            else if (aba === 'auditoria') onNavigate('autosenha:dashboard-auditoria');
            else onNavigate('autosenha:dashboard');
          }}
          onNavigateUnidade={(unidadeId, sub) => {
            onNavigate(`autosenha:${unidadeId}-${sub}`);
          }}
          onBack={() => onNavigate('autosenha')}
        />
      )}

      {/* 3. Senha TV (Painel Público de Televisão) */}
      {subView === 'psf1-senhatv' && (
        <SenhaTVScreen unidadeId="psf1" onBack={() => onNavigate('autosenha:psf1-controle')} />
      )}
      {subView === 'psf2-senhatv' && (
        <SenhaTVScreen unidadeId="psf2" onBack={() => onNavigate('autosenha:psf2-controle')} />
      )}
      {subView === 'upa-senhatv' && (
        <SenhaTVScreen unidadeId="upa" onBack={() => onNavigate('autosenha:upa-controle')} />
      )}

      {/* 4. Controle Operacional da Unidade (Recepção) */}
      {subView === 'psf1-controle' && (
        <AutoSenhaControleScreen
          unidadeId="psf1"
          currentUser={currentUser}
          onNavigateTV={() => onNavigate('autosenha:psf1-senhatv')}
          onBack={() => onNavigate('autosenha:psf1')}
        />
      )}
      {subView === 'psf2-controle' && (
        <AutoSenhaControleScreen
          unidadeId="psf2"
          currentUser={currentUser}
          onNavigateTV={() => onNavigate('autosenha:psf2-senhatv')}
          onBack={() => onNavigate('autosenha:psf2')}
        />
      )}
      {subView === 'upa-controle' && (
        <AutoSenhaControleScreen
          unidadeId="upa"
          currentUser={currentUser}
          onNavigateTV={() => onNavigate('autosenha:upa-senhatv')}
          onBack={() => onNavigate('autosenha:upa')}
        />
      )}

      {/* 5. Submódulo Individual do Posto (Cards Controle | Senha TV) */}
      {subView === 'psf1' && (
        <AutoSenhaPostoScreen
          unidadeId="psf1"
          onNavigateControle={() => onNavigate('autosenha:psf1-controle')}
          onNavigateTV={() => onNavigate('autosenha:psf1-senhatv')}
          onBack={() => onNavigate('autosenha')}
        />
      )}
      {subView === 'psf2' && (
        <AutoSenhaPostoScreen
          unidadeId="psf2"
          onNavigateControle={() => onNavigate('autosenha:psf2-controle')}
          onNavigateTV={() => onNavigate('autosenha:psf2-senhatv')}
          onBack={() => onNavigate('autosenha')}
        />
      )}
      {subView === 'upa' && (
        <AutoSenhaPostoScreen
          unidadeId="upa"
          onNavigateControle={() => onNavigate('autosenha:upa-controle')}
          onNavigateTV={() => onNavigate('autosenha:upa-senhatv')}
          onBack={() => onNavigate('autosenha')}
        />
      )}

      {/* 6. Página Inicial do Módulo (/AutoSenha) com os Cards Principais */}
      {(!subView || subView === 'home') && (
        <AutoSenhaHomeScreen
          currentUser={currentUser}
          onNavigateDashboard={() => onNavigate('autosenha:dashboard')}
          onNavigatePacientes={() => onNavigate('autosenha:pacientes')}
          onNavigatePSF1={() => onNavigate('autosenha:psf1')}
          onNavigatePSF2={() => onNavigate('autosenha:psf2')}
          onNavigateUPA={() => onNavigate('autosenha:upa')}
          onBack={() => onNavigate('home')}
        />
      )}
    </div>
  );
};
