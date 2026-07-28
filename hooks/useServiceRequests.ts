import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { Order } from '../types';
import * as diariasService from '../services/diariasService';

// Keys
export const serviceRequestKeys = {
    all: ['serviceRequests'] as const,
    lists: () => [...serviceRequestKeys.all, 'list'] as const,
    list: (filters: string) => [...serviceRequestKeys.lists(), { filters }] as const,
    details: () => [...serviceRequestKeys.all, 'detail'] as const,
    detail: (id: string) => [...serviceRequestKeys.details(), id] as const,
};

// Hook to fetch lightweight list
export const useServiceRequests = () => {
    const queryClient = useQueryClient();

    useEffect(() => {
        const channel = supabase
            .channel('realtime:service_requests')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'service_requests' },
                () => {
                    queryClient.invalidateQueries({ queryKey: serviceRequestKeys.lists() });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [queryClient]);

    return useQuery({
        queryKey: serviceRequestKeys.lists(),
        queryFn: async () => {
            // Updated service call to fetch ONLY lightweight fields
            return diariasService.getAllServiceRequests(true);
        },
        staleTime: 1000 * 60 * 5, // 5 minutes
        refetchOnWindowFocus: false,
    });
};

export const useInfiniteServiceRequests = (pageSize = 20, searchTerm = '') => {
    return useInfiniteQuery({
        queryKey: [...serviceRequestKeys.lists(), 'infinite', { searchTerm }],
        queryFn: async ({ pageParam = 0 }) => {
            return diariasService.getAllServiceRequests(true, pageParam as number, pageSize, searchTerm);
        },
        getNextPageParam: (lastPage, allPages) => {
            // If the last page has fewer items than pageSize, we've reached the end.
            // Otherwise, the next page index is the current number of pages.
            return lastPage.length === pageSize ? allPages.length : undefined;
        },
        initialPageParam: 0,
        staleTime: 0, // Garante atualizacao imediata ao acessar o Historico
        refetchOnWindowFocus: true,
    });
};

// Hook to fetch single full detail
export const useServiceRequest = (id: string | null) => {
    return useQuery({
        queryKey: serviceRequestKeys.detail(id || ''),
        queryFn: () => diariasService.getServiceRequestById(id!),
        enabled: !!id, // Only fetch if ID is present
        staleTime: 1000 * 60 * 15, // 15 minutes
        refetchOnWindowFocus: false,
    });
};

// Mutations
export const useCreateServiceRequest = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: diariasService.saveServiceRequest,
        onMutate: async (newOrder) => {
            await queryClient.cancelQueries({ queryKey: serviceRequestKeys.lists() });
            const previousOrders = queryClient.getQueryData<Order[]>(serviceRequestKeys.lists());

            // Optimistic Update
            if (previousOrders) {
                queryClient.setQueryData<Order[]>(serviceRequestKeys.lists(), [
                    { ...newOrder, id: newOrder.id || 'temp-id', createdAt: new Date().toISOString() },
                    ...previousOrders,
                ]);
            }

            return { previousOrders };
        },
        onError: (err, newOrder, context) => {
            if (context?.previousOrders) {
                queryClient.setQueryData(serviceRequestKeys.lists(), context.previousOrders);
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: serviceRequestKeys.lists() });
        },
    });
};

export const useUpdateServiceRequest = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: diariasService.saveServiceRequest,
        onMutate: async (updatedOrder) => {
            await queryClient.cancelQueries({ queryKey: serviceRequestKeys.lists() });
            await queryClient.cancelQueries({ queryKey: serviceRequestKeys.detail(updatedOrder.id) });

            const previousOrders = queryClient.getQueryData<Order[]>(serviceRequestKeys.lists());
            const previousDetail = queryClient.getQueryData<Order>(serviceRequestKeys.detail(updatedOrder.id));

            // Optimistic List Update
            if (previousOrders) {
                queryClient.setQueryData<Order[]>(serviceRequestKeys.lists(),
                    previousOrders.map(order => order.id === updatedOrder.id ? { ...order, ...updatedOrder } : order)
                );
            }

            // Optimistic Detail Update
            if (previousDetail) {
                queryClient.setQueryData<Order>(serviceRequestKeys.detail(updatedOrder.id), { ...previousDetail, ...updatedOrder });
            }

            return { previousOrders, previousDetail };
        },
        onError: (err, updatedOrder, context) => {
            if (context?.previousOrders) {
                queryClient.setQueryData(serviceRequestKeys.lists(), context.previousOrders);
            }
            if (context?.previousDetail) {
                queryClient.setQueryData(serviceRequestKeys.detail(updatedOrder.id), context.previousDetail);
            }
        },
        onSettled: (data, error, variables) => {
            queryClient.invalidateQueries({ queryKey: serviceRequestKeys.lists() });
            queryClient.invalidateQueries({ queryKey: serviceRequestKeys.detail(variables.id) });
        },
    });
};

export const useDeleteServiceRequest = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: diariasService.deleteServiceRequest,
        onMutate: async (id) => {
            await queryClient.cancelQueries({ queryKey: serviceRequestKeys.lists() });
            const previousOrders = queryClient.getQueryData<Order[]>(serviceRequestKeys.lists());

            if (previousOrders) {
                queryClient.setQueryData<Order[]>(serviceRequestKeys.lists(),
                    previousOrders.filter(order => order.id !== id)
                );
            }

            return { previousOrders };
        },
        onError: (err, id, context) => {
            if (context?.previousOrders) {
                queryClient.setQueryData(serviceRequestKeys.lists(), context.previousOrders);
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: serviceRequestKeys.lists() });
        },
    });
};
