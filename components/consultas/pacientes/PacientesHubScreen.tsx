import React, { useState, useEffect, useCallback } from 'react';
import { User } from '../../../types';
import { PacienteBuscaScreen } from './PacienteBuscaScreen';
import { PacienteDashboardScreen, AbaPaciente } from './PacienteDashboardScreen';

interface PacientesHubScreenProps {
    onBack: () => void;
    currentUser?: User | null;
    accentColor?: string;
}

export const PacientesHubScreen: React.FC<PacientesHubScreenProps> = ({
    onBack,
    currentUser
}) => {
    // Parse da Rota atual a partir da window.location.pathname
    const parseRoute = useCallback(() => {
        if (typeof window === 'undefined') {
            return { pacienteId: null, aba: 'visao-geral' as AbaPaciente, pagina: 1 };
        }

        const rawPath = window.location.pathname;
        // Padrão: /Regulacao/Pacientes/:id ou /Regulacao/Pacientes/pagina/:num e opcionais /solicitacoes, etc.
        const regex = /\/(?:regulacao|consultas)\/pacientes\/([^/]+)(?:\/([^/]+))?/i;
        const match = rawPath.match(regex);

        if (match && match[1]) {
            const rawId = match[1];

            // Rota específica de paginação: /Regulacao/Pacientes/pagina/:num
            if (rawId.toLowerCase() === 'pagina') {
                const num = parseInt(match[2] || '1', 10);
                return {
                    pacienteId: null,
                    aba: 'visao-geral' as AbaPaciente,
                    pagina: isNaN(num) || num < 1 ? 1 : num
                };
            }

            // Se não for rota estática
            if (rawId.toLowerCase() !== 'novo' && rawId.toLowerCase() !== 'dados') {
                let subAba: AbaPaciente = 'visao-geral';
                const rawAba = (match[2] || '').toLowerCase();
                if (rawAba === 'solicitacoes') subAba = 'solicitacoes';
                else if (rawAba === 'medicamentos') subAba = 'medicamentos';
                else if (rawAba === 'linha-do-tempo') subAba = 'linha-do-tempo';
                else if (rawAba === 'analise') subAba = 'analise';

                return { pacienteId: rawId, aba: subAba, pagina: 1 };
            }
        }

        // Suporte opcional a query string: ?pagina=2 ou ?page=2
        const searchParams = new URLSearchParams(window.location.search);
        const queryPage = parseInt(searchParams.get('pagina') || searchParams.get('page') || '1', 10);

        return {
            pacienteId: null,
            aba: 'visao-geral' as AbaPaciente,
            pagina: isNaN(queryPage) || queryPage < 1 ? 1 : queryPage
        };
    }, []);

    const [routeInfo, setRouteInfo] = useState(parseRoute());

    useEffect(() => {
        const handlePopState = () => {
            setRouteInfo(parseRoute());
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [parseRoute]);

    // Navega para o Dashboard Individual do Paciente
    const handleSelectPaciente = (id: string) => {
        if (typeof window !== 'undefined') {
            const targetUrl = `/Regulacao/Pacientes/${id}`;
            window.history.pushState({}, '', targetUrl);
            window.dispatchEvent(new Event('popstate'));
        }
        setRouteInfo({ pacienteId: id, aba: 'visao-geral', pagina: 1 });
    };

    // Volta para a tela de localização / busca de pacientes
    const handleBackToBusca = () => {
        if (typeof window !== 'undefined') {
            const targetUrl = '/Regulacao/Pacientes';
            window.history.pushState({}, '', targetUrl);
            window.dispatchEvent(new Event('popstate'));
        }
        setRouteInfo({ pacienteId: null, aba: 'visao-geral', pagina: 1 });
    };

    if (routeInfo.pacienteId) {
        return (
            <PacienteDashboardScreen
                pacienteId={routeInfo.pacienteId}
                onBack={handleBackToBusca}
                currentUser={currentUser}
                initialAba={routeInfo.aba}
            />
        );
    }

    return (
        <PacienteBuscaScreen
            onSelectPaciente={handleSelectPaciente}
            onBack={onBack}
            currentUser={currentUser}
            initialPagina={routeInfo.pagina}
        />
    );
};
