import { supabase } from './supabaseClient';
import { AppState } from '../types';

export const getGlobalSettings = async (): Promise<AppState | null> => {
    try {
        const { data, error } = await supabase
            .from('organization_settings')
            .select('branding, document_config, ui_config')
            .eq('id', 'global_config')
            .single();

        if (error) {
            console.warn('Error fetching global settings (full), attempting fallback:', error.message);
            throw error; // Trigger fallback
        }

        if (!data) return null;

        return {
            branding: data.branding,
            document: data.document_config,
            ui: data.ui_config || {},
            content: {} as any
        } as AppState;

    } catch (err) {
        console.error('Primary settings fetch failed. Attempting partial fetch...');
        try {
            // Fallback: Fetch critical columns individually
            const [brandingReq, documentReq, uiReq] = await Promise.all([
                supabase.from('organization_settings').select('branding').eq('id', 'global_config').single(),
                supabase.from('organization_settings').select('document_config').eq('id', 'global_config').single(),
                supabase.from('organization_settings').select('ui_config').eq('id', 'global_config').single()
            ]);

            const branding = brandingReq.data?.branding;
            const docConfig = documentReq.data?.document_config;
            const uiConfig = uiReq.data?.ui_config;

            if (!branding && !docConfig) {
                console.error('Fallback settings fetch also failed or returned no data.');
                return null;
            }

            return {
                branding: branding || {},
                document: docConfig || {},
                ui: uiConfig || {},
                content: {} as any
            } as AppState;

        } catch (fallbackErr) {
            console.error('Critical: Failed to load global settings even with fallback.', fallbackErr);
            return null;
        }
    }
};

export const saveGlobalSettings = async (settings: AppState): Promise<boolean> => {
    const { error } = await supabase
        .from('organization_settings')
        .upsert({
            id: 'global_config',
            branding: settings.branding,
            document_config: settings.document,
            ui_config: settings.ui,
            updated_at: new Date().toISOString()
        });

    if (error) {
        console.error('Error saving global settings to Supabase:', error);
        return false;
    }
    return true;
};

export const uploadAsset = async (file: File, folder: 'logos' | 'watermarks' = 'logos'): Promise<string | null> => {
    try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${folder}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
            .from('document-assets')
            .upload(fileName, file);

        if (uploadError) {
            console.error('Error uploading asset:', uploadError);
            return null;
        }

        const { data } = supabase.storage
            .from('document-assets')
            .getPublicUrl(fileName);

        return data.publicUrl;
    } catch (err) {
        console.error('Unexpected error uploading asset:', err);
        return null;
    }
};

export const updateSystemUpdateTarget = async (timestamp: number | null): Promise<boolean> => {
    try {
        const { error } = await supabase
            .from('organization_settings')
            .update({ system_update_target: timestamp })
            .eq('id', 'global_config');

        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Error updating system update target:', error);
        return false;
    }
};
