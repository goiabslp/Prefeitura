-- Migration: Add recurso column to public.consultas_procedimentos table
ALTER TABLE public.consultas_procedimentos 
ADD COLUMN IF NOT EXISTS recurso TEXT DEFAULT 'Não Se Aplica' CHECK (recurso IN ('Não Se Aplica', 'FM', 'PPI'));
