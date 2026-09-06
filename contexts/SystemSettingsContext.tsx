import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { MODULE_ACCESS_TREE } from '../services/permissionService';

interface ModuleSetting {
    id: string;
    module_key: string;
    label: string;
    is_enabled: boolean;
    is_enabled_mobile: boolean;
    parent_key: string | null;
    order_index: number;
    description?: string;
}

interface SystemSettingsContextType {
    moduleStatus: Record<string, boolean>; // key: module_key, value: is_enabled (web)
    mobileModuleStatus: Record<string, boolean>; // key: module_key, value: is_enabled_mobile
    isLoading: boolean;
    toggleModule: (key: string, enabled: boolean, channel?: 'web' | 'mobile') => Promise<boolean>;
    settings: ModuleSetting[];
}

const SystemSettingsContext = createContext<SystemSettingsContextType>({
    moduleStatus: {},
    mobileModuleStatus: {},
    isLoading: true,
    toggleModule: async () => false,
    settings: []
});

export const SystemSettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [settings, setSettings] = useState<ModuleSetting[]>([]);
    const [moduleStatus, setModuleStatus] = useState<Record<string, boolean>>({});
    const [mobileModuleStatus, setMobileModuleStatus] = useState<Record<string, boolean>>({});
    const [isLoading, setIsLoading] = useState(true);

    // Initial Fetch
    const fetchSettings = async () => {
        try {
            const { data, error } = await supabase
                .from('global_module_settings')
                .select('*')
                .order('order_index');

            if (error) {
                console.error('Error fetching global settings:', error);
                setIsLoading(false);
                return;
            }

            if (data) {
                const fetchedSettings = data as ModuleSetting[];
                
                // Garantir fallback estático para parent_diarias_viajar se ausente no banco
                const hasViajar = fetchedSettings.some(s => s.module_key === 'parent_diarias_viajar');
                if (!hasViajar) {
                    fetchedSettings.push({
                        id: 'fallback_viajar',
                        module_key: 'parent_diarias_viajar',
                        label: 'Viajar',
                        is_enabled: true,
                        is_enabled_mobile: true,
                        parent_key: 'parent_diarias',
                        order_index: 6,
                        description: 'Permissão para iniciar e finalizar viagens em tempo real'
                    });
                }

                const hasConsultasPacientes = fetchedSettings.some(s => s.module_key === 'parent_consultas_pacientes');
                if (!hasConsultasPacientes) {
                    fetchedSettings.push({
                        id: 'fallback_consultas_pacientes',
                        module_key: 'parent_consultas_pacientes',
                        label: 'Pacientes',
                        is_enabled: true,
                        is_enabled_mobile: true,
                        parent_key: 'parent_consultas',
                        order_index: 4,
                        description: 'Permissão para gestão da base de pacientes no módulo de consultas'
                    });
                }

                const hasConsultasGestor = fetchedSettings.some(s => s.module_key === 'parent_consultas_gestor');
                if (!hasConsultasGestor) {
                    fetchedSettings.push({
                        id: 'fallback_consultas_gestor',
                        module_key: 'parent_consultas_gestor',
                        label: 'Gestor',
                        is_enabled: true,
                        is_enabled_mobile: true,
                        parent_key: 'parent_consultas',
                        order_index: 5,
                        description: 'Permissão para gestão avançada de permissões no módulo de consultas'
                    });
                }

                const hasFarmaciaPacientes = fetchedSettings.some(s => s.module_key === 'parent_farmacia_pacientes');
                if (!hasFarmaciaPacientes) {
                    fetchedSettings.push({
                        id: 'fallback_farmacia_pacientes',
                        module_key: 'parent_farmacia_pacientes',
                        label: 'Pacientes',
                        is_enabled: true,
                        is_enabled_mobile: true,
                        parent_key: 'parent_farmacia',
                        order_index: 5,
                        description: 'Permissão para gestão da base de pacientes no módulo da farmácia popular'
                    });
                }

                const hasFarmaciaGestor = fetchedSettings.some(s => s.module_key === 'parent_farmacia_gestor');
                if (!hasFarmaciaGestor) {
                    fetchedSettings.push({
                        id: 'fallback_farmacia_gestor',
                        module_key: 'parent_farmacia_gestor',
                        label: 'Gestor',
                        is_enabled: true,
                        is_enabled_mobile: true,
                        parent_key: 'parent_farmacia',
                        order_index: 6,
                        description: 'Permissão para gestão avançada de permissões no módulo da farmácia popular'
                    });
                }

                // Fallbacks estáticos para Agendamento de Veículos
                const hasAgendamentoAgendar = fetchedSettings.some(s => s.module_key === 'parent_agendamento_veiculo_agendar');
                if (!hasAgendamentoAgendar) {
                    fetchedSettings.push({
                        id: 'fallback_agendamento_veiculo_agendar',
                        module_key: 'parent_agendamento_veiculo_agendar',
                        label: 'Agendar Veículo',
                        is_enabled: true,
                        is_enabled_mobile: true,
                        parent_key: 'parent_agendamento_veiculo',
                        order_index: 1,
                        description: 'Permissão para solicitar e agendar novas viagens'
                    });
                }

                const hasAgendamentoMeus = fetchedSettings.some(s => s.module_key === 'parent_agendamento_veiculo_meus');
                if (!hasAgendamentoMeus) {
                    fetchedSettings.push({
                        id: 'fallback_agendamento_veiculo_meus',
                        module_key: 'parent_agendamento_veiculo_meus',
                        label: 'Meus Agendamentos',
                        is_enabled: true,
                        is_enabled_mobile: true,
                        parent_key: 'parent_agendamento_veiculo',
                        order_index: 2,
                        description: 'Permissão para consultar o histórico de solicitações'
                    });
                }

                const hasAgendamentoAprovacoes = fetchedSettings.some(s => s.module_key === 'parent_agendamento_veiculo_aprovacoes');
                if (!hasAgendamentoAprovacoes) {
                    fetchedSettings.push({
                        id: 'fallback_agendamento_veiculo_aprovacoes',
                        module_key: 'parent_agendamento_veiculo_aprovacoes',
                        label: 'Aprovações',
                        is_enabled: true,
                        is_enabled_mobile: true,
                        parent_key: 'parent_agendamento_veiculo',
                        order_index: 3,
                        description: 'Permissão para análise e aprovação de agendamentos'
                    });
                }

                const hasAgendamentoDashboard = fetchedSettings.some(s => s.module_key === 'parent_agendamento_veiculo_dashboard');
                if (!hasAgendamentoDashboard) {
                    fetchedSettings.push({
                        id: 'fallback_agendamento_veiculo_dashboard',
                        module_key: 'parent_agendamento_veiculo_dashboard',
                        label: 'Dashboard Analítico',
                        is_enabled: true,
                        is_enabled_mobile: true,
                        parent_key: 'parent_agendamento_veiculo',
                        order_index: 4,
                        description: 'Permissão para visualização de relatórios e estatísticas da frota'
                    });
                }
                
                setSettings(fetchedSettings);
                
                const webStatusMap: Record<string, boolean> = {};
                const mobileStatusMap: Record<string, boolean> = {};
                
                fetchedSettings.forEach(s => {
                    webStatusMap[s.module_key] = s.is_enabled;
                    mobileStatusMap[s.module_key] = s.is_enabled_mobile ?? true;
                });
                
                setModuleStatus(webStatusMap);
                setMobileModuleStatus(mobileStatusMap);
            }
        } catch (err) {
            console.error('Unexpected error fetching settings:', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchSettings();

        // Realtime Subscription
        const subscription = supabase
            .channel('global_settings_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'global_module_settings' }, (payload) => {
                fetchSettings();
            })
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    const toggleModule = async (key: string, enabled: boolean, channel: 'web' | 'mobile' = 'web') => {
        const fieldName = channel === 'web' ? 'is_enabled' : 'is_enabled_mobile';

        // Localiza metadados e chaves associadas na árvore canônica
        let metaLabel = key;
        let metaParent: string | null = null;
        let metaOrder = 99;
        const associatedKeys: string[] = [key];

        for (const parent of MODULE_ACCESS_TREE) {
            if (parent.key === key) {
                metaLabel = parent.label;
                if (parent.legacyKeys) associatedKeys.push(...parent.legacyKeys);
                break;
            }
            const sub = parent.submodules?.find(s => s.key === key);
            if (sub) {
                metaLabel = sub.label;
                metaParent = parent.key;
                if (sub.legacyKeys) associatedKeys.push(...sub.legacyKeys);
                break;
            }
        }

        // 1. UPDATE OTIMISTA IMEDIATO (Zero Latência na Interface)
        const previousWeb = moduleStatus[key];
        const previousMobile = mobileModuleStatus[key];

        if (channel === 'web') {
            setModuleStatus(prev => {
                const next = { ...prev };
                associatedKeys.forEach(k => { next[k] = enabled; });
                return next;
            });
        } else {
            setMobileModuleStatus(prev => {
                const next = { ...prev };
                associatedKeys.forEach(k => { next[k] = enabled; });
                return next;
            });
        }
        setSettings(prev => prev.map(s => associatedKeys.includes(s.module_key) ? { ...s, [fieldName]: enabled } : s));

        try {
            const existingObj = settings.find(s => s.module_key === key);

            // Upsert direto no Supabase em background para a chave canônica
            const upsertPayload: any = {
                module_key: key,
                label: existingObj?.label || metaLabel,
                parent_key: existingObj?.parent_key || metaParent,
                order_index: existingObj?.order_index || metaOrder,
                is_enabled: channel === 'web' ? enabled : (previousWeb ?? true),
                is_enabled_mobile: channel === 'mobile' ? enabled : (previousMobile ?? true),
                updated_at: new Date().toISOString()
            };

            const { error } = await supabase
                .from('global_module_settings')
                .upsert(upsertPayload, { onConflict: 'module_key' });

            if (error) {
                console.error('Error in upsert global_module_settings:', error);
                // Reverte em caso de erro real
                if (channel === 'web') {
                    setModuleStatus(prev => ({ ...prev, [key]: previousWeb }));
                } else {
                    setMobileModuleStatus(prev => ({ ...prev, [key]: previousMobile }));
                }
                return false;
            }

            // Sincroniza também quaisquer registros legados que já existiam no banco
            const existingLegacies = settings.filter(s => s.module_key !== key && associatedKeys.includes(s.module_key));
            if (existingLegacies.length > 0) {
                for (const leg of existingLegacies) {
                    await supabase
                        .from('global_module_settings')
                        .update({
                            [fieldName]: enabled,
                            updated_at: new Date().toISOString()
                        })
                        .eq('module_key', leg.module_key);
                }
            }

            return true;
        } catch (error) {
            console.error('Error toggling module:', error);
            // Reverte em caso de falha
            if (channel === 'web') {
                setModuleStatus(prev => ({ ...prev, [key]: previousWeb }));
            } else {
                setMobileModuleStatus(prev => ({ ...prev, [key]: previousMobile }));
            }
            return false;
        }
    };

    return (
        <SystemSettingsContext.Provider value={{ moduleStatus, mobileModuleStatus, isLoading, toggleModule, settings }}>
            {children}
        </SystemSettingsContext.Provider>
    );
};

export const useSystemSettings = () => useContext(SystemSettingsContext);
