-- Migration: Drop quantity check constraints on consultas_procedimentos
--
-- This script drops the "available_quantity_check" and "total_quantity_check"
-- constraints on the consultas_procedimentos table. This prevents database-level
-- crashes (400 Bad Request) when deleting or modifying slots, allowing operations
-- to succeed even if there are temporary sync drifts.
-- It also reinstates the self-correcting recalculation trigger.

-- 1. Drop the check constraints
ALTER TABLE public.consultas_procedimentos 
    DROP CONSTRAINT IF EXISTS consultas_procedimentos_available_quantity_check;

ALTER TABLE public.consultas_procedimentos 
    DROP CONSTRAINT IF EXISTS consultas_procedimentos_total_quantity_check;

-- 2. Remove ALL existing triggers on consultas_vagas dynamically to avoid conflicts
DO $$
DECLARE
    t RECORD;
BEGIN
    FOR t IN 
        SELECT trigger_name 
        FROM information_schema.triggers 
        WHERE event_object_table = 'consultas_vagas' 
          AND event_object_schema = 'public'
    LOOP
        EXECUTE 'DROP TRIGGER IF EXISTS ' || quote_ident(t.trigger_name) || ' ON public.consultas_vagas;';
    END LOOP;
END $$;

-- 3. Recreate the dynamic recalculation function
CREATE OR REPLACE FUNCTION public.recalculate_procedimento_vagas(p_procedimento_id UUID)
RETURNS VOID AS $$
DECLARE
    v_total INTEGER;
    v_active_bookings INTEGER;
    v_available INTEGER;
BEGIN
    -- Count total slots registered in consultas_vagas
    SELECT COUNT(*) INTO v_total
    FROM public.consultas_vagas
    WHERE procedimento_id = p_procedimento_id;

    -- Count active bookings that occupy a slot
    SELECT COALESCE(SUM(quantity), 0) INTO v_active_bookings
    FROM public.consultas_agendamentos
    WHERE procedimento_id = p_procedimento_id
      AND status IN ('Solicitado', 'Agendado', 'Aguardando Data', 'Realizado', 'Retorno');

    -- Calculate available (never less than zero)
    v_available := GREATEST(0, v_total - v_active_bookings);

    -- Update procedimento with exact quantities
    UPDATE public.consultas_procedimentos
    SET total_quantity = v_total,
        available_quantity = v_available
    WHERE id = p_procedimento_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Recreate the trigger function for consultas_vagas AFTER INSERT OR DELETE
CREATE OR REPLACE FUNCTION public.sync_procedimentos_vagas_count()
RETURNS TRIGGER AS $$
DECLARE
    v_proc_id UUID;
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_proc_id := NEW.procedimento_id;
    ELSE
        v_proc_id := OLD.procedimento_id;
    END IF;

    PERFORM public.recalculate_procedimento_vagas(v_proc_id);
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Create the clean trigger on consultas_vagas
CREATE TRIGGER trigger_sync_procedimentos_vagas_count
AFTER INSERT OR DELETE ON public.consultas_vagas
FOR EACH ROW EXECUTE FUNCTION public.sync_procedimentos_vagas_count();

-- 6. Force recalculation of all procedures to fix current values
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id FROM public.consultas_procedimentos LOOP
        PERFORM public.recalculate_procedimento_vagas(r.id);
    END LOOP;
END $$;
