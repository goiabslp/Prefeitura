-- MIGRATION: REMOVE 20% VACANCY RESERVATION FOR URGENCY
-- Execute este script no editor SQL do console do Supabase para aplicar a mudança no banco de dados.

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

            -- Se permaneceu ocupando vaga (não virou fila de espera), reduz a cota
            IF (NEW.status IN ('Solicitado', 'Agendado', 'Aguardando Data', 'Realizado', 'Retorno')) THEN
                UPDATE public.consultas_procedimentos
                SET available_quantity = available_quantity - NEW.quantity
                WHERE id = NEW.procedimento_id;
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

            IF (NEW.status IN ('Solicitado', 'Agendado', 'Aguardando Data', 'Realizado', 'Retorno')) THEN
                UPDATE public.consultas_procedimentos
                SET available_quantity = available_quantity - NEW.quantity
                WHERE id = NEW.procedimento_id;
            END IF;

        -- Caso 2: De ocupante para não-ocupante de vaga
        ELSIF (v_old_occupies AND NOT v_new_occupies) THEN
            UPDATE public.consultas_procedimentos
            SET available_quantity = available_quantity + OLD.quantity
            WHERE id = OLD.procedimento_id;

        -- Caso 3: Ambos ocupam, mas detalhes mudaram
        ELSIF (v_old_occupies AND v_new_occupies) THEN
            IF (OLD.quantity <> NEW.quantity OR OLD.priority <> NEW.priority OR OLD.appointment_date <> NEW.appointment_date) THEN
                SELECT available_quantity, total_quantity INTO v_available, v_total
                FROM public.consultas_procedimentos
                WHERE id = NEW.procedimento_id;

                -- Ambas as prioridades podem utilizar 100% do saldo de vagas.
                IF (v_available + OLD.quantity) < NEW.quantity THEN
                    RAISE EXCEPTION 'Vagas esgotadas para este procedimento.';
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
        RETURN OLD;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
