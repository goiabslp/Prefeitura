-- Migration: Add solicitation_date to consultas_agendamentos and update queue sorting

-- 1. Add column solicitation_date to consultas_agendamentos table
ALTER TABLE public.consultas_agendamentos 
ADD COLUMN IF NOT EXISTS solicitation_date DATE DEFAULT CURRENT_DATE;

-- 2. Update existing records to use their created_at date as solicitation_date
UPDATE public.consultas_agendamentos 
SET solicitation_date = created_at::date 
WHERE solicitation_date IS NULL;

-- 3. Update public.processar_fila_espera_consultas to sort by solicitation_date
CREATE OR REPLACE FUNCTION public.processar_fila_espera_consultas(p_procedimento_id UUID)
RETURNS VOID AS $$
DECLARE
    v_available INTEGER;
    v_total INTEGER;
    v_reserved INTEGER;
    r RECORD;
BEGIN
    -- Loop through waiting list entries for this procedure, oldest first.
    -- Priority 'Urgência' goes first, then normal priority, sorted by solicitation_date, then created_at.
    FOR r IN 
        SELECT id, appointment_date, quantity, priority 
        FROM public.consultas_agendamentos
        WHERE procedimento_id = p_procedimento_id 
          AND status = 'Fila de espera'
        ORDER BY 
            CASE WHEN priority = 'Urgência' THEN 0 ELSE 1 END ASC, 
            COALESCE(solicitation_date, appointment_date, created_at::date) ASC, 
            created_at ASC
    LOOP
        -- Get current availability
        SELECT available_quantity, total_quantity INTO v_available, v_total
        FROM public.consultas_procedimentos
        WHERE id = p_procedimento_id;

        -- Calculate reserved slots (20%) - bypass in the last week of the month
        IF EXTRACT(MONTH FROM r.appointment_date) <> EXTRACT(MONTH FROM (r.appointment_date + INTERVAL '7 days')) THEN
            v_reserved := 0;
        ELSE
            v_reserved := CEIL(v_total * 0.20);
        END IF;

        -- Check if this booking can be scheduled
        IF (r.priority = 'Normal') THEN
            IF v_available >= (v_reserved + r.quantity) THEN
                UPDATE public.consultas_agendamentos
                SET status = 'Aguardando Data'
                WHERE id = r.id;
            END IF;
        ELSE
            IF v_available >= r.quantity THEN
                UPDATE public.consultas_agendamentos
                SET status = 'Aguardando Data'
                WHERE id = r.id;
            END IF;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;
