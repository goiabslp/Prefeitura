import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as licitacaoService from '../services/licitacaoService';
import { LicitacaoProcesso } from '../types/licitacao';

export const licitacaoKeys = {
    all: ['licitacao_processos'] as const,
    process: (id: string) => ['licitacao_processos', id] as const,
    permissions: (userId: string) => ['licitacao_permissoes', userId] as const,
    lists: () => [...licitacaoKeys.all, 'list'] as const,
    details: () => [...licitacaoKeys.all, 'detail'] as const,
    detail: (id: string) => [...licitacaoKeys.details(), id] as const,
};

export const useLicitacaoProcesses = () => {
    return useQuery({
        queryKey: licitacaoKeys.lists(),
        queryFn: licitacaoService.getLicitacaoProcesses
    });
};

export const useLicitacaoProcess = (id: string | null) => {
    return useQuery({
        queryKey: licitacaoKeys.process(id!),
        queryFn: () => licitacaoService.getLicitacaoProcessById(id!),
        enabled: !!id
    });
};

export const useUserLicitacaoPermission = (userId: string | null) => {
    return useQuery({
        queryKey: licitacaoKeys.permissions(userId!),
        queryFn: () => licitacaoService.getUserLicitacaoPermission(userId!),
        enabled: !!userId
    });
};

export const useCreateLicitacaoProcessCompleto = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: licitacaoService.createLicitacaoProcessCompleto,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: licitacaoKeys.all });
        }
    });
};

export const useUpdateLicitacaoProcess = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, updates }: { id: string; updates: Partial<LicitacaoProcesso> }) => licitacaoService.updateLicitacaoProcess(id, updates),
        onSuccess: (data, variables) => {
            queryClient.setQueriesData({ queryKey: licitacaoKeys.lists() }, (oldData: LicitacaoProcesso[] | undefined) => {
                if (!oldData) return oldData;
                return oldData.map(p => p.id === variables.id ? { ...p, ...variables.updates } : p);
            });
            queryClient.invalidateQueries({ queryKey: licitacaoKeys.all });
            if (variables?.id) {
                queryClient.invalidateQueries({ queryKey: licitacaoKeys.process(variables.id) });
            }
        }
    });
};

export const useAddLicitacaoDocument = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: licitacaoService.addLicitacaoDocument,
        onSuccess: (data) => {
            if (data && data.processo_id) {
                queryClient.invalidateQueries({ queryKey: licitacaoKeys.process(data.processo_id) });
                queryClient.invalidateQueries({ queryKey: licitacaoKeys.all });
            }
        }
    });
};

export const useDeleteLicitacaoDocument = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, processo_id, url }: { id: string, processo_id: string, url?: string }) => {
            await licitacaoService.deleteLicitacaoDocument(id, url);
            return { processo_id };
        },
        onSuccess: (data) => {
            if (data && data.processo_id) {
                queryClient.invalidateQueries({ queryKey: licitacaoKeys.process(data.processo_id) });
                queryClient.invalidateQueries({ queryKey: licitacaoKeys.all });
            }
        }
    });
};
