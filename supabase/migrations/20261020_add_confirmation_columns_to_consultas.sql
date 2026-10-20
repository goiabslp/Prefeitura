-- ====================================================================================
-- MIGRAÇÃO: Adiciona colunas para confirmação de comparecimento em consultas_agendamentos
-- ====================================================================================

-- 1. Adicionar colunas caso ainda não existam
ALTER TABLE public.consultas_agendamentos ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;
ALTER TABLE public.consultas_agendamentos ADD COLUMN IF NOT EXISTS confirmed_by UUID;
ALTER TABLE public.consultas_agendamentos ADD COLUMN IF NOT EXISTS confirmed_by_name TEXT;
ALTER TABLE public.consultas_agendamentos ADD COLUMN IF NOT EXISTS confirmation_origin TEXT;

-- 2. Índices de performance
CREATE INDEX IF NOT EXISTS idx_consultas_agendamentos_confirmed_at 
  ON public.consultas_agendamentos (confirmed_at);
