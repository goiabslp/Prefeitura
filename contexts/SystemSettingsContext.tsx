import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';

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
        try {
            const { data: updatedData, error } = await supabase
                .from('global_module_settings')
                .update({ [fieldName]: enabled, updated_at: new Date().toISOString() })
                .eq('module_key', key)
                .select();

            if (error || !updatedData || updatedData.length === 0) {
                // Upsert para novos módulos fallback estáticos
                const existingObj = settings.find(s => s.module_key === key);
                if (existingObj) {
                    await supabase.from('global_module_settings').upsert({
                        module_key: key,
                        label: existingObj.label,
                        parent_key: existingObj.parent_key,
                        order_index: existingObj.order_index,
                        is_enabled: channel === 'web' ? enabled : true,
                        is_enabled_mobile: channel === 'mobile' ? enabled : true,
                        updated_at: new Date().toISOString()
                    });
                }
            }

            // Optimistic update
            if (channel === 'web') {
                setModuleStatus(prev => ({ ...prev, [key]: enabled }));
            } else {
                setMobileModuleStatus(prev => ({ ...prev, [key]: enabled }));
            }
            
            setSettings(prev => prev.map(s => s.module_key === key ? { ...s, [fieldName]: enabled } : s));

            return true;
        } catch (error) {
            console.error('Error toggling module:', error);
            alert('Erro ao atualizar status do módulo.');
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
