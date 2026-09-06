import React, { useState, useEffect } from 'react';
import { ArtStudioHub } from './ArtStudioHub';
import { ArtCreationWizard } from './ArtCreationWizard';
import { ArtLogosManager } from './ArtLogosManager';
import { ArtReferencesManager } from './ArtReferencesManager';
import { ArtHistoryScreen } from './ArtHistoryScreen';
import { ArtEditorScreen } from './ArtEditorScreen';
import { ArtPublication } from '../../types';
import { artStudioService } from '../../services/artStudioService';

interface ArtModuleProps {
  onBackToHome?: () => void;
  initialSubView?: 'hub' | 'criar' | 'logos' | 'referencias' | 'historico' | 'editor';
  currentUser?: any;
}

export const ArtModule: React.FC<ArtModuleProps> = ({
  onBackToHome,
  initialSubView = 'hub'
}) => {
  const [currentRoute, setCurrentRoute] = useState<string>(() => {
    const path = window.location.pathname;
    if (path.toLowerCase().startsWith('/art')) {
      return path;
    }
    return '/Art';
  });

  const [selectedPublicationId, setSelectedPublicationId] = useState<string | null>(() => {
    const path = window.location.pathname;
    if (path.toLowerCase().includes('/art/editor/')) {
      const parts = path.split('/');
      return parts[parts.length - 1] || null;
    }
    const params = new URLSearchParams(window.location.search);
    return params.get('id') || null;
  });

  const navigateTo = (targetUrl: string) => {
    if (window.location.pathname !== targetUrl) {
      window.history.pushState({}, '', targetUrl);
    }
    setCurrentRoute(targetUrl);

    // Extrai ID se for editor
    if (targetUrl.toLowerCase().includes('/art/editor/')) {
      const parts = targetUrl.split('/');
      setSelectedPublicationId(parts[parts.length - 1] || null);
    }
  };

  // Sincronização com o botão Voltar / Avançar do navegador (popstate)
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      if (path.toLowerCase().startsWith('/art')) {
        setCurrentRoute(path);
        if (path.toLowerCase().includes('/art/editor/')) {
          const parts = path.split('/');
          setSelectedPublicationId(parts[parts.length - 1] || null);
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const pathLower = currentRoute.toLowerCase();

  // Rota: /Art/Logos
  if (pathLower.includes('/art/logos')) {
    return (
      <ArtLogosManager
        onBack={() => navigateTo('/Art')}
        onNavigate={navigateTo}
      />
    );
  }

  // Rota: /Art/Referencias
  if (pathLower.includes('/art/referencias')) {
    return (
      <ArtReferencesManager
        onBack={() => navigateTo('/Art')}
        onNavigate={navigateTo}
      />
    );
  }

  // Rota: /Art/Historico
  if (pathLower.includes('/art/historico')) {
    return (
      <ArtHistoryScreen
        onBack={() => navigateTo('/Art')}
        onNavigate={navigateTo}
        onSelectPublication={(pubId) => {
          setSelectedPublicationId(pubId);
          navigateTo(`/Art/Editor/${pubId}`);
        }}
      />
    );
  }

  // Rota: /Art/Editor ou /Art/Editor/:id
  if (pathLower.includes('/art/editor')) {
    return (
      <ArtEditorScreen
        publicationId={selectedPublicationId}
        onBack={() => navigateTo('/Art/Historico')}
        onNavigate={navigateTo}
      />
    );
  }

  // Rota: /Art/Criar
  if (pathLower.includes('/art/criar')) {
    return (
      <ArtCreationWizard
        onBack={() => navigateTo('/Art')}
        onNavigate={navigateTo}
        onEditPublication={(pubId) => {
          setSelectedPublicationId(pubId);
          navigateTo(`/Art/Editor/${pubId}`);
        }}
      />
    );
  }

  // Rota Padrão: /Art (Hub)
  return (
    <ArtStudioHub
      onBack={() => {
        if (onBackToHome) {
          onBackToHome();
        } else {
          window.history.pushState({}, '', '/');
          window.dispatchEvent(new Event('popstate'));
        }
      }}
      onNavigate={navigateTo}
      onSelectPublication={(pubId) => {
        setSelectedPublicationId(pubId);
        navigateTo(`/Art/Editor/${pubId}`);
      }}
    />
  );
};
