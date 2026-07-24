import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import * as oficiosService from '../services/oficiosService';
import { Order } from '../types';
import { supabase } from '../services/supabaseClient';

export const oficioKeys = {
    all: ['oficios'] as const,
    lists: () => [...oficioKeys.all, 'list'] as const,
    details: () => [...oficioKeys.all, 'detail'] as const,
    detail: (id: string) => [...oficioKeys.details(), id] as const,
};

// Update useOficio to use the key
export const useOficio = (id: string | null) => {
    return useQuery({
        queryKey: oficioKeys.detail(id || ''),
        queryFn: () => oficiosService.getOficioById(id!),
        enabled: !!id,
        staleTime: 1000 * 60 * 15, // 15 minutes
        refetchOnWindowFocus: false,
    });
};

// Hook to fetch all oficios
export const useOficios = () => {
    const queryClient = useQueryClient();

    useEffect(() => {
        const channel = supabase
            .channel('realtime:oficios')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'oficios' },
                () => {
                    queryClient.invalidateQueries({ queryKey: oficioKeys.lists() });
                }
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    // Optional: console.log('Oficios realtime connected');
                }
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [queryClient]);

    return useQuery({
        queryKey: oficioKeys.lists(),
        queryFn: () => oficiosService.getAllOficios(true), // lightweight = true
        staleTime: 1000 * 60 * 5, // 5 minutes
        refetchOnWindowFocus: false,
    });
};

export const useInfiniteOficios = (pageSize = 20, searchTerm = '') => {
    return useInfiniteQuery({
        queryKey: [...oficioKeys.lists(), 'infinite', { searchTerm }],
        queryFn: async ({ pageParam = 0 }) => {
            return oficiosService.getAllOficios(true, pageParam as number, pageSize, searchTerm);
        },
        getNextPageParam: (lastPage, allPages) => {
            return lastPage.length === pageSize ? allPages.length : undefined;
        },
        initialPageParam: 0,
        staleTime: 1000 * 60 * 10, // 10 minutes cache
        refetchOnWindowFocus: false,
    });
};

export const useCreateOficio = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: oficiosService.saveOficio,
        onMutate: async (newOficio) => {
            // Check for strictly new items vs updates (though saveOficio handles upsert)
            // For optimistic UI on CREATE, we need a temporary ID if one isn't provided, 
            // but usually the app generates one before saving.

            await queryClient.cancelQueries({ queryKey: oficioKeys.lists() });
            const previousOficios = queryClient.getQueryData<Order[]>(oficioKeys.lists());

            if (previousOficios) {
                queryClient.setQueryData<Order[]>(oficioKeys.lists(), (old) => {
                    return old ? [newOficio, ...old] : [newOficio];
                });
            }

            return { previousOficios };
        },
        onError: (_err, _newOficio, context) => {
            if (context?.previousOficios) {
                queryClient.setQueryData(oficioKeys.lists(), context.previousOficios);
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: oficioKeys.lists() });
        },
    });
};

export const useUpdateOficio = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: oficiosService.saveOficio,
        onMutate: async (updatedOficio) => {
            await queryClient.cancelQueries({ queryKey: oficioKeys.lists() });
            const previousOficios = queryClient.getQueryData<Order[]>(oficioKeys.lists());

            if (previousOficios) {
                queryClient.setQueryData<Order[]>(oficioKeys.lists(), (old) =>
                    old?.map((oficio) => (oficio.id === updatedOficio.id ? updatedOficio : oficio))
                );
            }

            return { previousOficios };
        },
        onError: (_err, _updatedOficio, context) => {
            if (context?.previousOficios) {
                queryClient.setQueryData(oficioKeys.lists(), context.previousOficios);
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: oficioKeys.lists() });
        },
    });
};

export const useDeleteOficio = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: oficiosService.deleteOficio,
        onMutate: async (id) => {
            await queryClient.cancelQueries({ queryKey: oficioKeys.lists() });
            const previousOficios = queryClient.getQueryData<Order[]>(oficioKeys.lists());

            if (previousOficios) {
                queryClient.setQueryData<Order[]>(oficioKeys.lists(), (old) =>
                    old?.filter((oficio) => oficio.id !== id)
                );
            }

            return { previousOficios };
        },
        onError: (_err, _id, context) => {
            if (context?.previousOficios) {
                queryClient.setQueryData(oficioKeys.lists(), context.previousOficios);
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: oficioKeys.lists() });
        },
    });
};

export const useUpdateOficioDescription = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, description }: { id: string; description: string }) => oficiosService.updateOficioDescription(id, description),
        onMutate: async ({ id, description }) => {
            await queryClient.cancelQueries({ queryKey: oficioKeys.lists() });
            const previousOficios = queryClient.getQueryData<Order[]>(oficioKeys.lists());

            if (previousOficios) {
                queryClient.setQueryData<Order[]>(oficioKeys.lists(), (old) =>
                    old?.map((oficio) => (oficio.id === id ? { ...oficio, description } : oficio))
                );
            }

            return { previousOficios };
        },
        onError: (_err, _vars, context) => {
            if (context?.previousOficios) {
                queryClient.setQueryData(oficioKeys.lists(), context.previousOficios);
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: oficioKeys.lists() });
        },
    });
};
