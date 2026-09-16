-- Execute este script no Editor SQL do painel do Supabase:
-- Adiciona suporte a tipos de retorno e auditoria de cancelamento

ALTER TABLE public.consultas_agendamentos ADD COLUMN IF NOT EXISTS is_retorno BOOLEAN DEFAULT FALSE;
ALTER TABLE public.consultas_agendamentos ADD COLUMN IF NOT EXISTS retorno_tipo TEXT;
ALTER TABLE public.consultas_agendamentos ADD COLUMN IF NOT EXISTS retorno_grau INTEGER;
ALTER TABLE public.consultas_agendamentos ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
ALTER TABLE public.consultas_agendamentos ADD COLUMN IF NOT EXISTS canceled_by UUID;
ALTER TABLE public.consultas_agendamentos ADD COLUMN IF NOT EXISTS canceled_by_name TEXT;
ALTER TABLE public.consultas_agendamentos ADD COLUMN IF NOT EXISTS canceled_at TIMESTAMPTZ;

-- Recarregar cache de schema
NOTIFY pgrst, 'reload schema';
