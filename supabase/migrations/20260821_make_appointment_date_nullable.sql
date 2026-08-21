-- Migration: Permitir appointment_date como NULL para agendamentos em Fila de Espera / Aguardando Data

-- 1. Remover restrição NOT NULL da coluna appointment_date na tabela public.consultas_agendamentos
ALTER TABLE public.consultas_agendamentos 
ALTER COLUMN appointment_date DROP NOT NULL;

-- 2. Atualizar a função do trigger para tratar appointment_date nulo utilizando solicitation_date como fallback para cálculo de reservas
CREATE OR REPLACE FUNCTION public.handle_consultas_vagas_change()
RETURNS TRIGGER AS $$
DECLARE
    v_available INTEGER;
    v_total INTEGER;
    v_reserved INTEGER;
    v_old_occupies BOOLEAN := FALSE;
    v_new_occupies BOOLEAN := FALSE;
    v_target_date DATE;
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

            v_target_date := COALESCE(NEW.appointment_date, NEW.solicitation_date, CURRENT_DATE);

            -- 20% reservation calculation (bypass in the last week of the month)
            IF EXTRACT(MONTH FROM v_target_date) <> EXTRACT(MONTH FROM (v_target_date + INTERVAL '7 days')) THEN
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

            v_target_date := COALESCE(NEW.appointment_date, NEW.solicitation_date, CURRENT_DATE);

            IF EXTRACT(MONTH FROM v_target_date) <> EXTRACT(MONTH FROM (v_target_date + INTERVAL '7 days')) THEN
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
            IF (OLD.quantity <> NEW.quantity OR OLD.priority <> NEW.priority OR OLD.appointment_date IS DISTINCT FROM NEW.appointment_date) THEN
                SELECT available_quantity, total_quantity INTO v_available, v_total
                FROM public.consultas_procedimentos
                WHERE id = NEW.procedimento_id;

                v_target_date := COALESCE(NEW.appointment_date, NEW.solicitation_date, CURRENT_DATE);

                IF EXTRACT(MONTH FROM v_target_date) <> EXTRACT(MONTH FROM (v_target_date + INTERVAL '7 days')) THEN
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
