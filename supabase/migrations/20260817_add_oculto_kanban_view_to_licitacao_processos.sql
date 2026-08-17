-- Migração: Adicionar campo de visibilidade no Kanban/TV para a tabela licitacao_processos
ALTER TABLE public.licitacao_processos ADD COLUMN IF NOT EXISTS oculto_kanban_view BOOLEAN DEFAULT FALSE;
