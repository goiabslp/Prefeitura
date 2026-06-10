-- Migration: Add 'Aguardando Data' status to consultations and update triggers

-- 1. Drop existing inline status check constraint dynamically and add new one
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
          AND pg_get_constraintdef(c.oid) LIKE '%status%'
    LOOP
        EXECUTE 'ALTER TABLE public.consultas_agendamentos DROP CONSTRAINT ' || quote_ident(r.conname);
    END LOOP;
END $$;

ALTER TABLE public.consultas_agendamentos 
ADD CONSTRAINT consultas_agendamentos_status_check 
CHECK (status IN ('Solicitado', 'Agendado', 'Realizado', 'Cancelado', 'Não Realizado', 'Fila de espera', 'Aguardando Data'));

-- 2. Update processar_fila_espera_consultas to promote to 'Aguardando Data' instead of 'Agendado'
CREATE OR REPLACE FUNCTION public.processar_fila_espera_consultas(p_procedimento_id UUID)
RETURNS VOID AS $$
DECLARE
    v_available INTEGER;
    v_total INTEGER;
    v_reserved INTEGER;
    r RECORD;
BEGIN
    -- Loop through waiting list entries for this procedure, oldest first.
    -- Priority 'Urgência' goes first, then normal priority, sorted by creation time.
    FOR r IN 
        SELECT id, appointment_date, quantity, priority 
        FROM public.consultas_agendamentos
        WHERE procedimento_id = p_procedimento_id 
          AND status = 'Fila de espera'
        ORDER BY CASE WHEN priority = 'Urgência' THEN 0 ELSE 1 END ASC, created_at ASC
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

-- 3. Update main trigger handle_consultas_vagas_change to handle Awaiting Date
CREATE OR REPLACE FUNCTION handle_consultas_vagas_change()
RETURNS TRIGGER AS $$
DECLARE
    v_available INTEGER;
    v_total INTEGER;
    v_reserved INTEGER;
    v_old_occupies BOOLEAN := FALSE;
    v_new_occupies BOOLEAN := FALSE;
BEGIN
    -- Avalia OLD.status apenas em UPDATE e DELETE
    IF (TG_OP = 'UPDATE' OR TG_OP = 'DELETE') THEN
        v_old_occupies := OLD.status IN ('Solicitado', 'Agendado', 'Aguardando Data', 'Realizado');
    END IF;

    -- Avalia NEW.status apenas em INSERT e UPDATE
    IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
        v_new_occupies := NEW.status IN ('Solicitado', 'Agendado', 'Aguardando Data', 'Realizado');
    END IF;

    IF (TG_OP = 'INSERT') THEN
        IF (v_new_occupies) THEN
            -- Get available and total quantity
            SELECT available_quantity, total_quantity INTO v_available, v_total
            FROM public.consultas_procedimentos
            WHERE id = NEW.procedimento_id;

            -- Calculate reserved slots (20%)
            IF EXTRACT(MONTH FROM NEW.appointment_date) <> EXTRACT(MONTH FROM (NEW.appointment_date + INTERVAL '7 days')) THEN
                v_reserved := 0;
            ELSE
                v_reserved := CEIL(v_total * 0.20);
            END IF;

            -- Validate based on priority
            IF (NEW.priority = 'Normal') THEN
                IF v_available < (v_reserved + NEW.quantity) THEN
                    NEW.status := 'Fila de espera';
                END IF;
            ELSE
                IF v_available < NEW.quantity THEN
                    NEW.status := 'Fila de espera';
                END IF;
            END IF;

            -- If it remains slot-consuming, decrement vacancy
            IF (NEW.status IN ('Solicitado', 'Agendado', 'Aguardando Data', 'Realizado')) THEN
                UPDATE public.consultas_procedimentos
                SET available_quantity = available_quantity - NEW.quantity
                WHERE id = NEW.procedimento_id;
            END IF;
        END IF;

    ELSIF (TG_OP = 'UPDATE') THEN
        -- Case 1: From non-slot-occupying to slot-occupying
        IF (NOT v_old_occupies AND v_new_occupies) THEN
            SELECT available_quantity, total_quantity INTO v_available, v_total
            FROM public.consultas_procedimentos
            WHERE id = NEW.procedimento_id;

            IF EXTRACT(MONTH FROM NEW.appointment_date) <> EXTRACT(MONTH FROM (NEW.appointment_date + INTERVAL '7 days')) THEN
                v_reserved := 0;
            ELSE
                v_reserved := CEIL(v_total * 0.20);
            END IF;

            IF (NEW.priority = 'Normal') THEN
                IF v_available < (v_reserved + NEW.quantity) THEN
                    NEW.status := 'Fila de espera';
                END IF;
            ELSE
                IF v_available < NEW.quantity THEN
                    NEW.status := 'Fila de espera';
                END IF;
            END IF;

            IF (NEW.status IN ('Solicitado', 'Agendado', 'Aguardando Data', 'Realizado')) THEN
                UPDATE public.consultas_procedimentos
                SET available_quantity = available_quantity - NEW.quantity
                WHERE id = NEW.procedimento_id;
            END IF;

        -- Case 2: From slot-occupying to non-slot-occupying
        ELSIF (v_old_occupies AND NOT v_new_occupies) THEN
            UPDATE public.consultas_procedimentos
            SET available_quantity = available_quantity + OLD.quantity
            WHERE id = OLD.procedimento_id;

        -- Case 3: Both occupy slots, but details (qty / priority / date) changed
        ELSIF (v_old_occupies AND v_new_occupies) THEN
            IF (OLD.quantity <> NEW.quantity OR OLD.priority <> NEW.priority OR OLD.appointment_date <> NEW.appointment_date) THEN
                SELECT available_quantity, total_quantity INTO v_available, v_total
                FROM public.consultas_procedimentos
                WHERE id = NEW.procedimento_id;

                IF EXTRACT(MONTH FROM NEW.appointment_date) <> EXTRACT(MONTH FROM (NEW.appointment_date + INTERVAL '7 days')) THEN
                    v_reserved := 0;
                ELSE
                    v_reserved := CEIL(v_total * 0.20);
                END IF;

                -- Check availability considering OLD quantity returned first
                IF (NEW.priority = 'Normal') THEN
                    IF (v_available + OLD.quantity) < (v_reserved + NEW.quantity) THEN
                        RAISE EXCEPTION 'Vagas normais esgotadas para este procedimento. Vagas restantes reservadas para Urgência.';
                    END IF;
                ELSE
                    IF (v_available + OLD.quantity) < NEW.quantity THEN
                        RAISE EXCEPTION 'Vagas esgotadas para este procedimento.';
                    END IF;
                END IF;

                UPDATE public.consultas_procedimentos
                SET available_quantity = available_quantity + OLD.quantity - NEW.quantity
                WHERE id = NEW.procedimento_id;
            END IF;
        END IF;

    ELSIF (TG_OP = 'DELETE') THEN
        IF (v_old_occupies) THEN
            UPDATE public.consultas_procedimentos
            SET available_quantity = available_quantity + OLD.quantity
            WHERE id = OLD.procedimento_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Update handle_consultas_vagas_after_change trigger to cover 'Aguardando Data'
CREATE OR REPLACE FUNCTION handle_consultas_vagas_after_change()
RETURNS TRIGGER AS $$
DECLARE
    v_old_occupies BOOLEAN := FALSE;
    v_new_occupies BOOLEAN := FALSE;
BEGIN
    -- Avalia OLD.status apenas em UPDATE e DELETE
    IF (TG_OP = 'UPDATE' OR TG_OP = 'DELETE') THEN
        v_old_occupies := OLD.status IN ('Solicitado', 'Agendado', 'Aguardando Data', 'Realizado');
    END IF;

    -- Avalia NEW.status apenas em UPDATE
    IF (TG_OP = 'UPDATE') THEN
        v_new_occupies := NEW.status IN ('Solicitado', 'Agendado', 'Aguardando Data', 'Realizado');
    END IF;

    IF (TG_OP = 'UPDATE') THEN
        -- If slots were released (transition from occupies to not occupies, or decrease in qty)
        IF (v_old_occupies AND NOT v_new_occupies) THEN
            PERFORM public.processar_fila_espera_consultas(NEW.procedimento_id);
        ELSIF (v_old_occupies AND v_new_occupies AND NEW.quantity < OLD.quantity) THEN
            PERFORM public.processar_fila_espera_consultas(NEW.procedimento_id);
        END IF;
    ELSIF (TG_OP = 'DELETE') THEN
        IF (v_old_occupies) THEN
            PERFORM public.processar_fila_espera_consultas(OLD.procedimento_id);
        END IF;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;
