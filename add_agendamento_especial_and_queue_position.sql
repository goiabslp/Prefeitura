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

-- 4. Atualizar a função do banco de dados para que novas vagas chamem primeiro os Agendamentos Especiais
CREATE OR REPLACE FUNCTION public.processar_fila_espera_consultas(p_procedimento_id UUID)
RETURNS VOID AS $$
DECLARE
    v_available INTEGER;
    v_total INTEGER;
    r RECORD;
BEGIN
    -- Itera pela fila de espera priorizando Agendamento Especial no topo, preservando a ordem cronológica
    FOR r IN 
        SELECT id, appointment_date, quantity, priority 
        FROM public.consultas_agendamentos
        WHERE procedimento_id = p_procedimento_id 
          AND status = 'Fila de espera'
        ORDER BY 
            CASE 
                WHEN priority = 'Especial' THEN 0 
                WHEN priority = 'Urgência' THEN 1 
                ELSE 2 
            END ASC, 
            COALESCE(solicitation_date, appointment_date, created_at::date) ASC, 
            created_at ASC
    LOOP
        SELECT available_quantity, total_quantity INTO v_available, v_total
        FROM public.consultas_procedimentos
        WHERE id = p_procedimento_id;

        IF v_available >= r.quantity THEN
            UPDATE public.consultas_agendamentos
            SET status = 'Aguardando Data'
            WHERE id = r.id;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;
