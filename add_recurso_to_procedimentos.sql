-- Migration: Add recurso column and unique index to public.consultas_procedimentos table
ALTER TABLE public.consultas_procedimentos 
ADD COLUMN IF NOT EXISTS recurso TEXT DEFAULT 'Não Se Aplica' CHECK (recurso IN ('Não Se Aplica', 'FM', 'PPI'));

-- Garantir que não existam registros duplicados combinando Nome, Tipo e Recurso
CREATE UNIQUE INDEX IF NOT EXISTS unique_procedimento_nome_tipo_recurso 
ON public.consultas_procedimentos (name, type, COALESCE(recurso, 'Não Se Aplica'));
