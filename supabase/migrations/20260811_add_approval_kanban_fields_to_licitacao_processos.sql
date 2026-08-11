-- Adicionar campos de controle de aprovação e Kanban na tabela licitacao_processos
ALTER TABLE public.licitacao_processos ADD COLUMN IF NOT EXISTS aprovado_em TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.licitacao_processos ADD COLUMN IF NOT EXISTS enviado_kanban_em TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.licitacao_processos ADD COLUMN IF NOT EXISTS apresentado_animacao BOOLEAN DEFAULT FALSE;
