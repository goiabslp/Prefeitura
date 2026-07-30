-- Adicionar coluna checklist para armazenar o estado de inspeção de veículos nas viagens
ALTER TABLE public.diarias_eventos
ADD COLUMN IF NOT EXISTS checklist JSONB DEFAULT '{}'::jsonb;
