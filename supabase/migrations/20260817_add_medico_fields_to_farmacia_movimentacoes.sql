-- Migration: Add medico fields to farmacia_movimentacoes table
ALTER TABLE public.farmacia_movimentacoes ADD COLUMN IF NOT EXISTS medico_crm TEXT;
ALTER TABLE public.farmacia_movimentacoes ADD COLUMN IF NOT EXISTS medico_uf TEXT;
ALTER TABLE public.farmacia_movimentacoes ADD COLUMN IF NOT EXISTS medico_nome TEXT;
ALTER TABLE public.farmacia_movimentacoes ADD COLUMN IF NOT EXISTS medico_consulta_data TIMESTAMP WITH TIME ZONE;
