-- Remoção do Módulo de Licitação

-- Dropar tabelas e relacionamentos
DROP TABLE IF EXISTS public.licitacao_processes CASCADE;
DROP TABLE IF EXISTS public.licitacao_items CASCADE;
DROP TABLE IF EXISTS public.licitacao_attachments CASCADE;
DROP TABLE IF EXISTS public.licitacao_history CASCADE;
DROP TABLE IF EXISTS public.licitacao_signatures CASCADE;
DROP TABLE IF EXISTS public.licitacao_drafts CASCADE;

-- Limpar possíveis dados residuais (Exemplo: configurações de contador se houver tabela de controle)
-- DELETE FROM public.counters WHERE module = 'licitacao';
