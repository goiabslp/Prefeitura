-- Migration: Fix available quantity recalculation triggers and prevent negative quotas

-- 1. Recreate the handle_consultas_vagas_change function without direct UPDATE statements on public.consultas_procedimentos
CREATE OR REPLACE FUNCTION public.handle_consultas_vagas_change()
RETURNS TRIGGER AS $$
DECLARE
    v_available INTEGER;
    v_total INTEGER;
    v_reserved INTEGER;
    v_old_occupies BOOLEAN := FALSE;
    v_new_occupies BOOLEAN := FALSE;
BEGIN
    -- Determine if OLD status occupies a slot
    IF (TG_OP = 'UPDATE' OR TG_OP = 'DELETE') THEN
        v_old_occupies := OLD.status IN ('Solicitado', 'Agendado', 'Aguardando Data', 'Realizado', 'Retorno');
    END IF;

    -- Determine if NEW status occupies a slot
    IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
        v_new_occupies := NEW.status IN ('Solicitado', 'Agendado', 'Aguardando Data', 'Realizado', 'Retorno');
    END IF;

    IF (TG_OP = 'INSERT') THEN
        IF (v_new_occupies) THEN
            SELECT available_quantity, total_quantity INTO v_available, v_total
            FROM public.consultas_procedimentos
            WHERE id = NEW.procedimento_id;

            -- 20% reservation calculation (bypass in the last week of the month)
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
        END IF;

    ELSIF (TG_OP = 'UPDATE') THEN
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

                -- For availability check, add back the OLD quantity to see what is available
                IF (NEW.priority = 'Normal') THEN
                    IF (v_available + OLD.quantity) < (v_reserved + NEW.quantity) THEN
                        RAISE EXCEPTION 'Vagas normais esgotadas para este procedimento. Vagas restantes reservadas para Urgência.';
                    END IF;
                ELSE
                    IF (v_available + OLD.quantity) < NEW.quantity THEN
                        RAISE EXCEPTION 'Vagas esgotadas para este procedimento.';
                    END IF;
                END IF;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Recreate the handle_consultas_vagas_after_change function to execute the full recalculation
CREATE OR REPLACE FUNCTION public.handle_consultas_vagas_after_change()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        PERFORM public.recalculate_procedimento_vagas(NEW.procedimento_id);
    ELSIF (TG_OP = 'UPDATE') THEN
        PERFORM public.recalculate_procedimento_vagas(NEW.procedimento_id);
        IF (OLD.procedimento_id <> NEW.procedimento_id) THEN
            PERFORM public.recalculate_procedimento_vagas(OLD.procedimento_id);
        END IF;
    ELSIF (TG_OP = 'DELETE') THEN
        PERFORM public.recalculate_procedimento_vagas(OLD.procedimento_id);
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Recreate the AFTER trigger on consultas_agendamentos to execute on INSERT, UPDATE, and DELETE
DROP TRIGGER IF EXISTS trigger_handle_consultas_vagas_after ON public.consultas_agendamentos;

CREATE TRIGGER trigger_handle_consultas_vagas_after
    AFTER INSERT OR UPDATE OR DELETE ON public.consultas_agendamentos
    FOR EACH ROW EXECUTE FUNCTION public.handle_consultas_vagas_after_change();

-- 4. Recreate the BEFORE trigger on consultas_agendamentos to ensure it works correctly (omitting DELETE since it's no longer doing manual decrement/increment)
DROP TRIGGER IF EXISTS trigger_handle_consultas_vagas ON public.consultas_agendamentos;

CREATE TRIGGER trigger_handle_consultas_vagas
    BEFORE INSERT OR UPDATE ON public.consultas_agendamentos
    FOR EACH ROW EXECUTE FUNCTION public.handle_consultas_vagas_change();

-- 5. Force recalculation of all procedures to fix current values to be exact and non-negative
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id FROM public.consultas_procedimentos LOOP
        PERFORM public.recalculate_procedimento_vagas(r.id);
    END LOOP;
END $$;
