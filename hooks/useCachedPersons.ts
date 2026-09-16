import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { Person } from '../types';

const CACHE_KEY = 'cached_persons_data';

export const personKeys = {
    all: ['persons'] as const,
};

export const useCachedPersons = (initialPersons: Person[] = []) => {
    const queryClient = useQueryClient();

    // Set up Realtime Subscription
    useEffect(() => {
        const channel = supabase
            .channel('persons_cache_sync')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'persons' }, () => {
                queryClient.invalidateQueries({ queryKey: personKeys.all });
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [queryClient]);

    return useQuery({
        queryKey: personKeys.all,
        queryFn: async () => {
            const { data, error } = await supabase
                .from('persons')
                .select('id, name, sector_id, job_id, birth_date, driver_code')
                .order('name');

            if (error) throw error;

            // Map snake_case to camelCase
            const mappedData = data.map(p => ({
                id: p.id,
                name: p.name,
                sectorId: p.sector_id,
                jobId: p.job_id,
                birth_date: p.birth_date,
                driver_code: p.driver_code
            }));

            if (mappedData) {
                localStorage.setItem(CACHE_KEY, JSON.stringify(mappedData));
            }

            return mappedData || [];
        },
        initialData: () => {
            const cached = localStorage.getItem(CACHE_KEY);
            if (cached) {
                try {
                    const parsed = JSON.parse(cached);
                    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
                } catch (e) {
                    console.error("Error parsing cached persons:", e);
                }
            }
            return initialPersons.length > 0 ? initialPersons : undefined;
        },
        staleTime: 1000 * 60 * 5, // 5 minutes
        retry: 3,
        retryDelay: (attempt) => Math.min(1000 * Math.pow(2, attempt), 30000),
    });
};
