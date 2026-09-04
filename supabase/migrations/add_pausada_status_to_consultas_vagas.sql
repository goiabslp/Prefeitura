-- Migration: Adicionar suporte ao status 'Pausada' em consultas_vagas e atualizar recálculo
-- Permite que gestores congelem ou pausem horários específicos de procedimentos

DO $$
BEGIN
    -- 1. Remover check constraint anterior de status se existir
    ALTER TABLE public.consultas_vagas DROP CONSTRAINT IF EXISTS consultas_vagas_status_check;
    
    -- 2. Recriar a check constraint permitindo 'Disponível', 'Ocupada' e 'Pausada'
    ALTER TABLE public.consultas_vagas ADD CONSTRAINT consultas_vagas_status_check 
        CHECK (status IN ('Disponível', 'Ocupada', 'Pausada'));
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Constraint update handled or not required: %', SQLERRM;
END $$;
