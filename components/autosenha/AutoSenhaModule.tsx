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

  // 1. Central Integrada de Pacientes (/AutoSenha/Pacientes)
  if (subView === 'pacientes') {
    return (
      <PacientesHubScreen
        currentUser={currentUser}
        onBack={() => onNavigate('autosenha')}
        baseRoute="/AutoSenha/Pacientes"
      />
    );
  }

  // 2. Dashboard Administrativo Centralizado
  if (subView === 'dashboard') {
    return (
      <AutoSenhaDashboardScreen
        currentUser={currentUser}
        onNavigateUnidade={(unidadeId, sub) => {
          onNavigate(`autosenha:${unidadeId}-${sub}`);
        }}
        onBack={() => onNavigate('autosenha')}
      />
    );
  }

  // 2. Senha TV (Painel Público de Televisão)
  if (subView === 'psf1-senhatv') {
    return <SenhaTVScreen unidadeId="psf1" onBack={() => onNavigate('autosenha:psf1-controle')} />;
  }
  if (subView === 'psf2-senhatv') {
    return <SenhaTVScreen unidadeId="psf2" onBack={() => onNavigate('autosenha:psf2-controle')} />;
  }
  if (subView === 'upa-senhatv') {
    return <SenhaTVScreen unidadeId="upa" onBack={() => onNavigate('autosenha:upa-controle')} />;
  }

  // 3. Controle Operacional da Unidade (Recepção)
  if (subView === 'psf1-controle') {
    return (
      <AutoSenhaControleScreen
        unidadeId="psf1"
        currentUser={currentUser}
        onNavigateTV={() => onNavigate('autosenha:psf1-senhatv')}
        onBack={() => onNavigate('autosenha:psf1')}
      />
    );
  }
  if (subView === 'psf2-controle') {
    return (
      <AutoSenhaControleScreen
        unidadeId="psf2"
        currentUser={currentUser}
        onNavigateTV={() => onNavigate('autosenha:psf2-senhatv')}
        onBack={() => onNavigate('autosenha:psf2')}
      />
    );
  }
  if (subView === 'upa-controle') {
    return (
      <AutoSenhaControleScreen
        unidadeId="upa"
        currentUser={currentUser}
        onNavigateTV={() => onNavigate('autosenha:upa-senhatv')}
        onBack={() => onNavigate('autosenha:upa')}
      />
    );
  }

  // 4. Submódulo Individual do Posto (Cards Controle | Senha TV)
  if (subView === 'psf1') {
    return (
      <AutoSenhaPostoScreen
        unidadeId="psf1"
        onNavigateControle={() => onNavigate('autosenha:psf1-controle')}
        onNavigateTV={() => onNavigate('autosenha:psf1-senhatv')}
        onBack={() => onNavigate('autosenha')}
      />
    );
  }
  if (subView === 'psf2') {
    return (
      <AutoSenhaPostoScreen
        unidadeId="psf2"
        onNavigateControle={() => onNavigate('autosenha:psf2-controle')}
        onNavigateTV={() => onNavigate('autosenha:psf2-senhatv')}
        onBack={() => onNavigate('autosenha')}
      />
    );
  }
  if (subView === 'upa') {
    return (
      <AutoSenhaPostoScreen
        unidadeId="upa"
        onNavigateControle={() => onNavigate('autosenha:upa-controle')}
        onNavigateTV={() => onNavigate('autosenha:upa-senhatv')}
        onBack={() => onNavigate('autosenha')}
      />
    );
  }

  // 5. Página Inicial do Módulo (/AutoSenha) com os Cards Principais
  return (
    <AutoSenhaHomeScreen
      currentUser={currentUser}
      onNavigateDashboard={() => onNavigate('autosenha:dashboard')}
      onNavigatePacientes={() => onNavigate('autosenha:pacientes')}
      onNavigatePSF1={() => onNavigate('autosenha:psf1')}
      onNavigatePSF2={() => onNavigate('autosenha:psf2')}
      onNavigateUPA={() => onNavigate('autosenha:upa')}
      onBack={() => onNavigate('home')}
    />
  );
};
