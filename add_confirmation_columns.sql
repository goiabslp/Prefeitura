-- ====================================================================================
-- SCRIPT SQL: Adiciona colunas para confirmação de comparecimento em consultas_agendamentos
-- Execute este script no SQL Editor do Supabase se desejar que o banco registre
-- nativamente a data e servidor que confirmou o atendimento.
-- ====================================================================================

ALTER TABLE public.consultas_agendamentos ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;
ALTER TABLE public.consultas_agendamentos ADD COLUMN IF NOT EXISTS confirmed_by UUID;
ALTER TABLE public.consultas_agendamentos ADD COLUMN IF NOT EXISTS confirmed_by_name TEXT;
ALTER TABLE public.consultas_agendamentos ADD COLUMN IF NOT EXISTS confirmation_origin TEXT;

CREATE INDEX IF NOT EXISTS idx_consultas_agendamentos_confirmed_at 
  ON public.consultas_agendamentos (confirmed_at);
