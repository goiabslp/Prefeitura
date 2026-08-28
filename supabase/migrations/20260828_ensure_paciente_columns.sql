-- Migration: Garantir que as colunas phone, sus_number e agente_saude existam na tabela consultas_pacientes
-- Execute este script no SQL Editor do Supabase Dashboard (https://supabase.com/dashboard)

-- Coluna phone (telefone do paciente)
ALTER TABLE public.consultas_pacientes ADD COLUMN IF NOT EXISTS phone TEXT;

-- Coluna sus_number (número do cartão SUS)
ALTER TABLE public.consultas_pacientes ADD COLUMN IF NOT EXISTS sus_number TEXT;

-- Coluna agente_saude (nome do agente comunitário de saúde - ACS)
ALTER TABLE public.consultas_pacientes ADD COLUMN IF NOT EXISTS agente_saude TEXT;

-- Recarregar o schema cache do PostgREST para que o Supabase reconheça as novas colunas imediatamente
NOTIFY pgrst, 'reload schema';
