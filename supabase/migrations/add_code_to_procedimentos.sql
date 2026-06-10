-- Migration: Adiciona coluna 'code' com constraint de 4 dígitos numéricos únicos na tabela consultas_procedimentos

ALTER TABLE public.consultas_procedimentos 
ADD COLUMN IF NOT EXISTS code TEXT;

-- Atualiza registros existentes que não possuem código atribuído
DO $$
DECLARE
    r RECORD;
    c INT := 1;
BEGIN
    FOR r IN SELECT id FROM public.consultas_procedimentos WHERE code IS NULL LOOP
        UPDATE public.consultas_procedimentos 
        SET code = LPAD(c::text, 4, '0') 
        WHERE id = r.id;
        c := c + 1;
    END LOOP;
END $$;

-- Adiciona a restrição de formato de 4 dígitos numéricos (ex: '0001', '9999')
ALTER TABLE public.consultas_procedimentos 
DROP CONSTRAINT IF EXISTS consultas_procedimentos_code_check;

ALTER TABLE public.consultas_procedimentos 
ADD CONSTRAINT consultas_procedimentos_code_check 
CHECK (code ~ '^\d{4}$');

-- Adiciona restrição de código único
ALTER TABLE public.consultas_procedimentos 
DROP CONSTRAINT IF EXISTS consultas_procedimentos_code_key;

ALTER TABLE public.consultas_procedimentos 
ADD CONSTRAINT consultas_procedimentos_code_key 
UNIQUE (code);
