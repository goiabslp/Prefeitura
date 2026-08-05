-- Script de Migração Completo para Atualização da Fase e Checklist da Licitação

-- 1. Adicionar colunas caso a tabela já existisse
ALTER TABLE public.licitacao_processos ADD COLUMN IF NOT EXISTS fase TEXT;
ALTER TABLE public.licitacao_processos ADD COLUMN IF NOT EXISTS checkin_finalizado JSONB DEFAULT '{}'::jsonb;

-- 2. Atualizar permissões RLS de atualização da licitação para permitir alteração de fase
DROP POLICY IF EXISTS "Atualização de Processos" ON public.licitacao_processos;
CREATE POLICY "Atualização de Processos" ON public.licitacao_processos FOR UPDATE USING (true);
