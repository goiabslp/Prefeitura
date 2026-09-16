import { QueryClient } from '@tanstack/react-query';

// Configuração otimizada para redução agressiva de Egress e mínimo tráfego de rede
export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 1000 * 60 * 10, // 10 minutos de dados mantidos válidos em cache
            gcTime: 1000 * 60 * 30, // 30 minutos em memória
            retry: 1,
            refetchOnWindowFocus: false, // Previne requisições repetitivas ao alternar abas
            refetchOnMount: false, // Reutiliza cache ao navegar entre telas sem nova requisição
            refetchOnReconnect: false, // Não sobrecarrega com refetches em massa na reconexão
        },
    },
});
