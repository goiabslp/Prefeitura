import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { Vehicle } from '../types';

const CACHE_KEY = 'cached_vehicles_data';

export const vehicleKeys = {
    all: ['vehicles'] as const,
};

export const useCachedVehicles = (initialVehicles: Vehicle[] = []) => {
    const queryClient = useQueryClient();

    // Set up Realtime Subscription
    useEffect(() => {
        const channel = supabase
            .channel('vehicles_cache_sync')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicles' }, () => {
                queryClient.invalidateQueries({ queryKey: vehicleKeys.all });
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [queryClient]);

    return useQuery({
        queryKey: vehicleKeys.all,
        queryFn: async () => {
            const { data, error } = await supabase
                .from('vehicles')
                .select('*')
                .order('plate', { ascending: true });

            if (error) throw error;

            const mappedVehicles = (data || []).map((v: any) => ({
                ...v,
                sectorId: v.sectorId || v.sector_id,
                responsiblePersonId: v.responsiblePersonId || v.responsible_person_id,
                documentUrl: v.documentUrl || v.document_url,
                documentName: v.documentName || v.document_name,
                vehicleImageUrl: v.vehicleImageUrl || v.vehicle_image_url || null,
                maintenanceStatus: v.maintenanceStatus || v.maintenance_status,
                fuelTypes: v.fuelTypes || v.fuel_types,
                requestManagerIds: v.requestManagerIds || v.request_manager_ids || [],
                maxKml: v.maxKml || v.max_kml,
                minKml: v.minKml || v.min_kml,
                currentKm: v.currentKm || v.current_km,
                oilLastChange: v.oilLastChange || v.oil_last_change,
                oilNextChange: v.oilNextChange || v.oil_next_change,
                oilCalculationBase: v.oilCalculationBase || v.oil_calculation_base,
            }));

            // Optional: Backup to LocalStorage if needed for offline-first boots
            if (mappedVehicles) {
                localStorage.setItem(CACHE_KEY, JSON.stringify(mappedVehicles));
            }

            return mappedVehicles;
        },
        initialData: () => {
            const cached = localStorage.getItem(CACHE_KEY);
            if (cached) {
                try {
                    const parsed = JSON.parse(cached);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        return parsed.map((v: any) => ({
                            ...v,
                            vehicleImageUrl: v.vehicleImageUrl || v.vehicle_image_url || null
                        }));
                    }
                } catch (e) {
                    console.error("Error parsing cached vehicles:", e);
                }
            }
            return initialVehicles.length > 0 ? initialVehicles.map((v: any) => ({
                ...v,
                vehicleImageUrl: v.vehicleImageUrl || v.vehicle_image_url || null
            })) : undefined;
        },
        staleTime: 1000 * 60 * 5, // 5 minutes
        retry: 3,
        retryDelay: (attempt) => Math.min(1000 * Math.pow(2, attempt), 30000),
    });
};
