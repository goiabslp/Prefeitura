-- Migration: Correção dos Triggers de Agendamento (Evita erros de registro OLD/NEW não inicializados)

-- 1. Atualiza a função do trigger BEFORE para avaliar OLD/NEW apenas nas operações aplicáveis e usar novos status
CREATE OR REPLACE FUNCTION handle_consultas_vagas_change()
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

-- 2. Atualiza a função do trigger AFTER para avaliar NEW.status apenas em UPDATE e usar novos status
CREATE OR REPLACE FUNCTION handle_consultas_vagas_after_change()
RETURNS TRIGGER AS $$
DECLARE
    v_old_occupies BOOLEAN := FALSE;
    v_new_occupies BOOLEAN := FALSE;
BEGIN
    -- Avalia OLD.status apenas em UPDATE e DELETE
    IF (TG_OP = 'UPDATE' OR TG_OP = 'DELETE') THEN
        v_old_occupies := OLD.status IN ('Solicitado', 'Agendado', 'Aguardando Data', 'Realizado', 'Retorno');
    END IF;

    -- Avalia NEW.status apenas em UPDATE
    IF (TG_OP = 'UPDATE') THEN
        v_new_occupies := NEW.status IN ('Solicitado', 'Agendado', 'Aguardando Data', 'Realizado', 'Retorno');
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

-- Recria os triggers para garantir que estão ativos e associados às funções corretas
DROP TRIGGER IF EXISTS trigger_handle_consultas_vagas ON public.consultas_agendamentos;
CREATE TRIGGER trigger_handle_consultas_vagas
    BEFORE INSERT OR UPDATE OR DELETE ON public.consultas_agendamentos
    FOR EACH ROW EXECUTE FUNCTION handle_consultas_vagas_change();

DROP TRIGGER IF EXISTS trigger_handle_consultas_vagas_after ON public.consultas_agendamentos;
CREATE TRIGGER trigger_handle_consultas_vagas_after
    AFTER UPDATE OR DELETE ON public.consultas_agendamentos
    FOR EACH ROW EXECUTE FUNCTION handle_consultas_vagas_after_change();

-- Função e trigger para processamento automático da fila ao alterar vagas do procedimento
CREATE OR REPLACE FUNCTION handle_procedimentos_vagas_after_change()
RETURNS TRIGGER AS $$
BEGIN
    IF (NEW.available_quantity > OLD.available_quantity) THEN
        PERFORM public.processar_fila_espera_consultas(NEW.id);
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_handle_procedimentos_vagas_after ON public.consultas_procedimentos;
CREATE TRIGGER trigger_handle_procedimentos_vagas_after
    AFTER UPDATE ON public.consultas_procedimentos
    FOR EACH ROW EXECUTE FUNCTION handle_procedimentos_vagas_after_change();
