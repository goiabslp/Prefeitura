-- Migration: Adicionar suporte à funcionalidade Pausar Solicitação no Módulo de Regulação

ALTER TABLE public.consultas_agendamentos
ADD COLUMN IF NOT EXISTS is_paused BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS paused_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS paused_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS paused_by_name TEXT,
ADD COLUMN IF NOT EXISTS pause_reason TEXT,
ADD COLUMN IF NOT EXISTS resumed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS resumed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS resumed_by_name TEXT,
ADD COLUMN IF NOT EXISTS original_status TEXT,
ADD COLUMN IF NOT EXISTS pause_history JSONB DEFAULT '[]'::jsonb;

-- Índice para performance de buscas por status e filtro de pausa
CREATE INDEX IF NOT EXISTS idx_consultas_agendamentos_paused ON public.consultas_agendamentos(is_paused, status);
