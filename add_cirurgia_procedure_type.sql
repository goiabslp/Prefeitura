-- Migration: Adiciona 'Cirurgia' como tipo de procedimento permitido
-- Remove o check constraint antigo e adiciona o novo contendo 'Cirurgia'

ALTER TABLE public.consultas_procedimentos 
    DROP CONSTRAINT IF EXISTS consultas_procedimentos_type_check;

ALTER TABLE public.consultas_procedimentos 
    ADD CONSTRAINT consultas_procedimentos_type_check 
    CHECK (type IN ('Exame', 'Consulta', 'Cirurgia'));
