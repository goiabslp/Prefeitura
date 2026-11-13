-- Migration: Adicionar coluna phone_fixed para telefone fixo em consultas_pacientes
-- Preserva todos os dados existentes e garante compatibilidade entre Regulação, Farmácia Popular e AutoSenha.

ALTER TABLE public.consultas_pacientes ADD COLUMN IF NOT EXISTS phone_fixed TEXT;

-- Comentário explicativo na coluna
COMMENT ON COLUMN public.consultas_pacientes.phone_fixed IS 'Telefone fixo do paciente com máscara (00) 0000-0000 (opcional)';

-- Recarregar o schema cache do PostgREST para o Supabase reconhecer a nova coluna imediatamente
NOTIFY pgrst, 'reload schema';
