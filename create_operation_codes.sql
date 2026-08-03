-- Execute este script no SQL Editor do Supabase para criar a tabela de códigos de operação rápidos
CREATE TABLE IF NOT EXISTS public.operation_codes (
    code VARCHAR(6) PRIMARY KEY,
    module VARCHAR(50) NOT NULL, -- 'diarias', 'compras', 'oficios', 'abastecimento'
    record_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.operation_codes ENABLE ROW LEVEL SECURITY;

-- Remover políticas se existirem para evitar conflito
DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON public.operation_codes;
DROP POLICY IF EXISTS "Enable insert access for all authenticated users" ON public.operation_codes;
DROP POLICY IF EXISTS "Enable delete access for all authenticated users" ON public.operation_codes;

-- Criar políticas
CREATE POLICY "Enable read access for all authenticated users" ON public.operation_codes
    FOR SELECT USING (true);

CREATE POLICY "Enable insert access for all authenticated users" ON public.operation_codes
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable delete access for all authenticated users" ON public.operation_codes
    FOR DELETE USING (true);

-- Adicionar colunas de suporte a anexos e observações na tabela de abastecimentos
ALTER TABLE public.abastecimentos
ADD COLUMN IF NOT EXISTS photo_url TEXT,
ADD COLUMN IF NOT EXISTS document_url TEXT,
ADD COLUMN IF NOT EXISTS observacoes TEXT;
