-- =========================================================================================
-- MIGRAÇÃO: Adiciona colunas para controle de Retornos e Cancelamento em consultas_agendamentos
-- =========================================================================================

-- 1. Colunas para suporte a Retornos médicos (1º Retorno, 2º Retorno, etc.)
ALTER TABLE public.consultas_agendamentos ADD COLUMN IF NOT EXISTS is_retorno BOOLEAN DEFAULT FALSE;
ALTER TABLE public.consultas_agendamentos ADD COLUMN IF NOT EXISTS retorno_tipo TEXT;
ALTER TABLE public.consultas_agendamentos ADD COLUMN IF NOT EXISTS retorno_grau INTEGER;

-- 2. Colunas para auditoria de cancelamento de consultas
ALTER TABLE public.consultas_agendamentos ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
ALTER TABLE public.consultas_agendamentos ADD COLUMN IF NOT EXISTS canceled_by UUID;
ALTER TABLE public.consultas_agendamentos ADD COLUMN IF NOT EXISTS canceled_by_name TEXT;
ALTER TABLE public.consultas_agendamentos ADD COLUMN IF NOT EXISTS canceled_at TIMESTAMPTZ;

-- 3. Recarrega o cache do PostgREST para o Supabase expor as colunas na API imediatamente
NOTIFY pgrst, 'reload schema';
