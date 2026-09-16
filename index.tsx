
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';
import { SystemSettingsProvider } from './contexts/SystemSettingsContext';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { queryClient } from './services/queryClient';
import { errorMonitor } from './services/errorMonitorService';
import { GlobalErrorBoundary } from './components/common/GlobalErrorBoundary';
import { GlobalErrorModal } from './components/common/GlobalErrorModal';

// Inicializa os interceptores globais de runtime JS, console e promises
errorMonitor.init();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const persister = createSyncStoragePersister({
  storage: window.localStorage,
});

const root = createRoot(rootElement);
root.render(
  <React.StrictMode>
    <GlobalErrorBoundary>
      <AuthProvider>
        <SystemSettingsProvider>
          <PersistQueryClientProvider
            client={queryClient}
            persistOptions={{
              persister,
              maxAge: 1000 * 60 * 60 * 24, // 24 hours persistence
            }}
          >
            <App />
            <GlobalErrorModal />
          </PersistQueryClientProvider>
        </SystemSettingsProvider>
      </AuthProvider>
    </GlobalErrorBoundary>
  </React.StrictMode>
);

