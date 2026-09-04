-- Migration: Adicionar prioridade Especial e colunas de ordenação da fila em consultas_agendamentos

-- 1. Atualizar constraint de verificação de prioridade para aceitar 'Especial'
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT conname 
        FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        JOIN pg_namespace n ON t.relnamespace = n.oid
        WHERE n.nspname = 'public' 
          AND t.relname = 'consultas_agendamentos' 
          AND c.contype = 'c' 
          AND pg_get_constraintdef(c.oid) LIKE '%priority%'
    LOOP
        EXECUTE 'ALTER TABLE public.consultas_agendamentos DROP CONSTRAINT ' || quote_ident(r.conname);
    END LOOP;
END $$;

ALTER TABLE public.consultas_agendamentos 
ADD CONSTRAINT consultas_agendamentos_priority_check 
CHECK (priority IN ('Normal', 'Urgência', 'Especial'));

-- 2. Adicionar colunas de posição e sequência na fila
ALTER TABLE public.consultas_agendamentos 
ADD COLUMN IF NOT EXISTS queue_position INTEGER;

ALTER TABLE public.consultas_agendamentos 
ADD COLUMN IF NOT EXISTS special_sequence INTEGER;

-- 3. Criar índice para agilizar consultas ordenadas pela fila
CREATE INDEX IF NOT EXISTS idx_consultas_agendamentos_queue_pos 
ON public.consultas_agendamentos(queue_position);

CREATE INDEX IF NOT EXISTS idx_consultas_agendamentos_priority_proc 
ON public.consultas_agendamentos(priority, procedimento_id, created_at);
