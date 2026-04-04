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
            const { error } = await supabase
                .from('global_module_settings')
                .update({ [fieldName]: enabled, updated_at: new Date().toISOString() })
                .eq('module_key', key);

            if (error) throw error;

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
