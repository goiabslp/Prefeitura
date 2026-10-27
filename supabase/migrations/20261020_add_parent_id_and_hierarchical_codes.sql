-- ==============================================================================
-- Migration: Estrutura hierárquica de Procedimentos e Especialistas Vinculados
-- ==============================================================================

-- 1. Adicionar colunas parent_id e especialista_id à tabela consultas_procedimentos
ALTER TABLE public.consultas_procedimentos 
ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.consultas_procedimentos(id) ON DELETE RESTRICT;

ALTER TABLE public.consultas_procedimentos 
ADD COLUMN IF NOT EXISTS especialista_id TEXT;

-- 2. Atualizar a constraint de validação de formato do código (code)
-- Remove a regra antiga que só permitia 4 dígitos (ex: 0739)
-- e aplica a nova regra que permite códigos principais de 4 dígitos ou códigos derivados com hífen (ex: 0739-10)
ALTER TABLE public.consultas_procedimentos 
DROP CONSTRAINT IF EXISTS consultas_procedimentos_code_check;

ALTER TABLE public.consultas_procedimentos 
ADD CONSTRAINT consultas_procedimentos_code_check 
CHECK (code IS NULL OR code ~ '^\d{4}(-\d+)?$');

-- 3. Adicionar índices para otimização de consultas hierárquicas e ordenação por código
CREATE INDEX IF NOT EXISTS idx_consultas_procedimentos_parent_id 
ON public.consultas_procedimentos(parent_id);

CREATE INDEX IF NOT EXISTS idx_consultas_procedimentos_code 
ON public.consultas_procedimentos(code);

CREATE INDEX IF NOT EXISTS idx_consultas_procedimentos_especialista_id 
ON public.consultas_procedimentos(especialista_id);

-- 4. Garantir que a tabela consultas_especialistas exista
CREATE TABLE IF NOT EXISTS public.consultas_especialistas (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    nome TEXT NOT NULL,
    especialidade TEXT,
    grupo TEXT DEFAULT 'MÉDICOS',
    status TEXT NOT NULL DEFAULT 'Ativo' CHECK (status IN ('Ativo', 'Inativo')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS e criar políticas permissivas se aplicável
ALTER TABLE public.consultas_especialistas ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'consultas_especialistas' AND policyname = 'Permitir acesso completo a consultas_especialistas'
    ) THEN
        CREATE POLICY "Permitir acesso completo a consultas_especialistas" 
        ON public.consultas_especialistas 
        FOR ALL 
        USING (true) 
        WITH CHECK (true);
    END IF;
END $$;

-- 5. Importar especialistas cadastrados no global_config de organization_settings (se existirem)
DO $$
DECLARE
    esp_record jsonb;
    org_config jsonb;
BEGIN
    SELECT ui_config INTO org_config 
    FROM public.organization_settings 
    WHERE id = 'global_config';

    IF org_config IS NOT NULL AND (org_config->'consultas_especialistas') IS NOT NULL THEN
        FOR esp_record IN SELECT * FROM jsonb_array_elements(org_config->'consultas_especialistas')
        LOOP
            INSERT INTO public.consultas_especialistas (id, nome, especialidade, grupo, status)
            VALUES (
                COALESCE(esp_record->>'id', gen_random_uuid()::text),
                COALESCE(esp_record->>'nome', 'NÃO INFORMADO'),
                esp_record->>'especialidade',
                COALESCE(esp_record->>'grupo', 'MÉDICOS'),
                COALESCE(esp_record->>'status', 'Ativo')
            )
            ON CONFLICT (id) DO NOTHING;
        END LOOP;
    END IF;
END $$;
