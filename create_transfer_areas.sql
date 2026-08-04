-- Script SQL para criar as tabelas de Área de Transferência Temporária
-- Execute este script no SQL Editor do Supabase.

-- 1. Tabela de Áreas de Transferência
CREATE TABLE IF NOT EXISTS public.transfer_areas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    code VARCHAR(6) UNIQUE NOT NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_by_name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (timezone('utc'::text, now()) + interval '15 minutes') NOT NULL
);

-- Habilitar RLS para transfer_areas
ALTER TABLE public.transfer_areas ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas para evitar erro de duplicidade ao re-executar
DROP POLICY IF EXISTS "Permitir leitura pública de áreas de transferência" ON public.transfer_areas;
DROP POLICY IF EXISTS "Permitir inserção de áreas de transferência" ON public.transfer_areas;
DROP POLICY IF EXISTS "Permitir deleção aos criadores" ON public.transfer_areas;

-- Políticas de segurança (RLS) para transfer_areas
CREATE POLICY "Permitir leitura pública de áreas de transferência" 
ON public.transfer_areas FOR SELECT USING (true);

CREATE POLICY "Permitir inserção de áreas de transferência" 
ON public.transfer_areas FOR INSERT WITH CHECK (true);

CREATE POLICY "Permitir deleção aos criadores" 
ON public.transfer_areas FOR DELETE USING (auth.uid() = created_by);

-- 2. Tabela de Arquivos da Área de Transferência
CREATE TABLE IF NOT EXISTS public.transfer_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transfer_area_id UUID REFERENCES public.transfer_areas(id) ON DELETE CASCADE NOT NULL,
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_size BIGINT,
    uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    uploaded_by_name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS para transfer_files
ALTER TABLE public.transfer_files ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas para evitar erro de duplicidade ao re-executar
DROP POLICY IF EXISTS "Permitir leitura pública de arquivos" ON public.transfer_files;
DROP POLICY IF EXISTS "Permitir inserção pública de arquivos" ON public.transfer_files;

-- Políticas de segurança (RLS) para transfer_files
CREATE POLICY "Permitir leitura pública de arquivos" 
ON public.transfer_files FOR SELECT USING (true);

CREATE POLICY "Permitir inserção pública de arquivos" 
ON public.transfer_files FOR INSERT WITH CHECK (true);

-- Habilitar Replicação de Tempo Real de forma idempotente para transfer_files e transfer_areas
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_rel pr
        JOIN pg_publication p ON p.oid = pr.prpubid
        JOIN pg_class c ON c.oid = pr.prrelid
        WHERE p.pubname = 'supabase_realtime' 
          AND c.relname = 'transfer_files'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.transfer_files;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_rel pr
        JOIN pg_publication p ON p.oid = pr.prpubid
        JOIN pg_class c ON c.oid = pr.prrelid
        WHERE p.pubname = 'supabase_realtime' 
          AND c.relname = 'transfer_areas'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.transfer_areas;
    END IF;
END $$;
