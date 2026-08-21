-- MIGRATION: REMOVE 20% VACANCY RESERVATION FOR URGENCY
-- Execute este script no editor SQL do console do Supabase para aplicar a mudança no banco de dados.

-- 1. Remover a reserva de 20% no trigger handle_consultas_vagas_change
CREATE OR REPLACE FUNCTION public.handle_consultas_vagas_change()
RETURNS TRIGGER AS $$
DECLARE
    v_available INTEGER;
    v_total INTEGER;
    v_old_occupies BOOLEAN := FALSE;
    v_new_occupies BOOLEAN := FALSE;
BEGIN
    -- Se for Retorno, garantir que is_retorno seja TRUE
    IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
        IF (NEW.status = 'Retorno') THEN
            NEW.is_retorno := TRUE;
        END IF;
    END IF;

    -- Avalia OLD.status apenas em UPDATE e DELETE
    IF (TG_OP = 'UPDATE' OR TG_OP = 'DELETE') THEN
        v_old_occupies := OLD.status IN ('Solicitado', 'Agendado', 'Aguardando Data', 'Realizado', 'Retorno');
    END IF;

    -- Avalia NEW.status apenas em INSERT e UPDATE
    IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
        v_new_occupies := NEW.status IN ('Solicitado', 'Agendado', 'Aguardando Data', 'Realizado', 'Retorno');
    END IF;

    IF (TG_OP = 'INSERT') THEN
        IF (v_new_occupies) THEN
            SELECT available_quantity, total_quantity INTO v_available, v_total
            FROM public.consultas_procedimentos
            WHERE id = NEW.procedimento_id;

            -- Ambas as prioridades podem utilizar 100% do saldo de vagas.
            IF v_available < NEW.quantity THEN
                NEW.status := 'Fila de espera';
            END IF;
        END IF;

    ELSIF (TG_OP = 'UPDATE') THEN
        -- Caso 1: De não-ocupante para ocupante de vaga
        IF (NOT v_old_occupies AND v_new_occupies) THEN
            SELECT available_quantity, total_quantity INTO v_available, v_total
            FROM public.consultas_procedimentos
            WHERE id = NEW.procedimento_id;

            -- Ambas as prioridades podem utilizar 100% do saldo de vagas.
            IF v_available < NEW.quantity THEN
                NEW.status := 'Fila de espera';
            END IF;

        -- Caso 2: Ambos ocupam, mas detalhes mudaram
        ELSIF (v_old_occupies AND v_new_occupies) THEN
            IF (OLD.quantity <> NEW.quantity OR OLD.priority <> NEW.priority OR OLD.appointment_date IS DISTINCT FROM NEW.appointment_date) THEN
                SELECT available_quantity, total_quantity INTO v_available, v_total
                FROM public.consultas_procedimentos
                WHERE id = NEW.procedimento_id;

                -- Ambas as prioridades podem utilizar 100% do saldo de vagas.
                IF (v_available + OLD.quantity) < NEW.quantity THEN
                    RAISE EXCEPTION 'Vagas esgotadas para este procedimento.';
                END IF;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Remover a reserva de 20% no processamento da fila de espera
CREATE OR REPLACE FUNCTION public.processar_fila_espera_consultas(p_procedimento_id UUID)
RETURNS VOID AS $$
DECLARE
    v_available INTEGER;
    v_total INTEGER;
    r RECORD;
BEGIN
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
