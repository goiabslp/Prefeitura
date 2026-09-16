import { supabase } from './supabaseClient';
import { VehicleDocument } from '../types';

export interface OilChangeRecord {
    id: string;
    vehicle_id: string;
    service_date: string;
    current_km: number;
    created_at: string;
    created_by?: string;
}

export const fleetService = {
    async addOilChangeRecord(vehicleId: string, currentKm: number, date: string = new Date().toISOString(), newBase?: number) {
        const safeKm = Math.round(currentKm);
        const { data, error } = await supabase
            .from('vehicle_oil_changes')
            .insert([
                {
                    vehicle_id: vehicleId,
                    current_km: safeKm,
                    service_date: date,
                }
            ])
            .select()
            .single();

        if (error) {
            console.error('Error adding oil change record:', error);
            throw error;
        }

        // ALSO UPDATE THE VEHICLE TABLE
        // We need to fetch the vehicle first to know the calculation base? 
        // Or we rely on client passing it? The client should pass it or we fetch it.
        // For simplicity, let's just assume we update last/next based on default or existing.
        // BETTER: The client already calculates 'next' in the UI. 
        // But to be safe, let's fetch the vehicle here or just update what we know.
        // Actually, let's just update oil_last_change. 
        // And we need to calculate oil_next_change.

        const { data: vehicleData, error: vehicleError } = await supabase
            .from('vehicles')
            .select('oil_calculation_base')
            .eq('id', vehicleId)
            .single();

        if (!vehicleError && vehicleData) {
            const base = newBase || vehicleData.oil_calculation_base || 5000;
            const next = Math.round(safeKm + base);

            await supabase.from('vehicles').update({
                oil_last_change: safeKm,
                oil_next_change: next,
                current_km: safeKm, // Update current KM too as confirmation
                oil_calculation_base: base // Persist the new base if changed
            }).eq('id', vehicleId);
        }

        return data;
    },

    async getOilChangeHistory(vehicleId: string): Promise<OilChangeRecord[]> {
        const { data, error } = await supabase
            .from('vehicle_oil_changes')
            .select('id, vehicle_id, current_km, service_date, created_at')
            .eq('vehicle_id', vehicleId)
            .order('service_date', { ascending: false });

        if (error) {
            console.error('Error fetching oil change history:', error);
            throw error;
        }

        return data || [];
    },

    async addTimingBeltRecord(vehicleId: string, currentKm: number, date: string = new Date().toISOString()) {
        const { data, error } = await supabase
            .from('vehicle_timing_belt_changes')
            .insert([
                {
                    vehicle_id: vehicleId,
                    current_km: currentKm,
                    service_date: date,
                }
            ])
            .select()
            .single();

        if (error) {
            console.error('Error adding timing belt record:', error);
            throw error;
        }

        // ALSO UPDATE THE VEHICLE TABLE
        const { data: vehicleData, error: vehicleError } = await supabase
            .from('vehicles')
            .select('timing_belt_calculation_base')
            .eq('id', vehicleId)
            .single();

        if (!vehicleError && vehicleData) {
            const base = vehicleData.timing_belt_calculation_base || 50000;
            const next = currentKm + base;

            await supabase.from('vehicles').update({
                timing_belt_last_change: currentKm,
                timing_belt_next_change: next,
                current_km: currentKm // Update current KM too as confirmation
            }).eq('id', vehicleId);
        }

        return data;
    },

    async getTimingBeltHistory(vehicleId: string): Promise<OilChangeRecord[]> {
        const { data, error } = await supabase
            .from('vehicle_timing_belt_changes')
            .select('id, vehicle_id, current_km, service_date, created_at')
            .eq('vehicle_id', vehicleId)
            .order('service_date', { ascending: false });

        if (error) {
            console.error('Error fetching timing belt history:', error);
            throw error;
        }

        return data || [];
    },

    async uploadVehicleDocument(vehicleId: string, file: File, description: string) {
        // 1. Upload file to Storage
        const fileExt = file.name.split('.').pop();
        const fileName = `${vehicleId}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
            .from('vehicle-documents')
            .upload(fileName, file);

        if (uploadError) {
            throw uploadError;
        }

        const { data: { publicUrl } } = supabase.storage
            .from('vehicle-documents')
            .getPublicUrl(fileName);

        // 2. Create record in vehicle_documents table
        const { data, error } = await supabase
            .from('vehicle_documents')
            .insert([
                {
                    vehicle_id: vehicleId,
                    name: file.name,
                    description: description,
                    file_url: publicUrl,
                    file_type: fileExt,
                    file_size: file.size
                }
            ])
            .select()
            .single();

        if (error) {
            console.error('Error creating document record:', error);
            throw error;
        }

        return data;
    },

    async getVehicleDocuments(vehicleId: string): Promise<VehicleDocument[]> {
        const { data, error } = await supabase
            .from('vehicle_documents')
            .select('id, vehicle_id, name, file_url, description, created_at')
            .eq('vehicle_id', vehicleId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching documents:', error);
            throw error;
        }

        return (data || []) as unknown as VehicleDocument[];
    },

    async deleteVehicleDocument(documentId: string, fileUrl: string) {
        // 1. Extract path from URL to delete from Storage (optional, but good practice to clean up)
        // URL format: .../vehicle-documents/vehicleId/timestamp.ext
        try {
            const path = fileUrl.split('/vehicle-documents/')[1];
            if (path) {
                await supabase.storage.from('vehicle-documents').remove([path]);
            }
        } catch (e) {
            console.error("Error deleting file from storage", e);
        }

        // 2. Delete from database
        const { error } = await supabase
            .from('vehicle_documents')
            .delete()
            .eq('id', documentId);

        if (error) {
            throw error;
        }
    }
};
