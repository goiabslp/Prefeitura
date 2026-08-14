import { QueryClient } from '@tanstack/react-query';

// Optimized for minimal requests and offline-first experience
export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 1000 * 60 * 5, // 5 minutos (dados mantidos válidos)
            gcTime: 1000 * 60 * 15, // 15 minutos (Garbage Collection libera memória RAM de dados não usados)
            retry: 1,
            refetchOnWindowFocus: false, // Previne requisições agressivas ao trocar de aba
            refetchOnMount: true, // Garante dados atualizados ao navegar
            refetchOnReconnect: true, // Sincroniza ao reconectar
        },
    },
});
