-- Migration: Atualiza os status dos agendamentos e regras de cotas correspondentes

-- 1. Remove a restrição antiga de status na tabela public.consultas_agendamentos
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

-- 2. Converte dados antigos 'Fila de Espera' para 'Fila de espera' primeiro para evitar violação de constraint
UPDATE public.consultas_agendamentos 
SET status = 'Fila de espera' 
WHERE status = 'Fila de Espera';

-- 3. Adiciona a nova restrição permitindo os novos status (incluindo Retorno) e coluna is_retorno
ALTER TABLE public.consultas_agendamentos 
ADD CONSTRAINT consultas_agendamentos_status_check 
CHECK (status IN ('Solicitado', 'Agendado', 'Realizado', 'Cancelado', 'Não Realizado', 'Fila de espera', 'Aguardando Data', 'Retorno'));

ALTER TABLE public.consultas_agendamentos ADD COLUMN IF NOT EXISTS is_retorno BOOLEAN DEFAULT FALSE;

-- 4. Atualiza a função de processamento da fila de espera
CREATE OR REPLACE FUNCTION public.processar_fila_espera_consultas(p_procedimento_id UUID)
RETURNS VOID AS $$
DECLARE
    v_available INTEGER;
    v_total INTEGER;
    v_reserved INTEGER;
    r RECORD;
BEGIN
    -- Loop pela fila de espera desse procedimento, ordenando por Urgência, Retorno e Normal (mais antigo primeiro)
    FOR r IN 
        SELECT id, appointment_date, quantity, priority, is_retorno 
        FROM public.consultas_agendamentos
        WHERE procedimento_id = p_procedimento_id 
          AND status = 'Fila de espera'
        ORDER BY 
            CASE 
                WHEN priority = 'Urgência' THEN 0 
                WHEN is_retorno = TRUE THEN 1 
                ELSE 2 
            END ASC, 
            created_at ASC
    LOOP
        -- Consulta quantidade de vagas atuais
        SELECT available_quantity, total_quantity INTO v_available, v_total
        FROM public.consultas_procedimentos
        WHERE id = p_procedimento_id;

        -- Calcula vagas de reserva
        IF EXTRACT(MONTH FROM r.appointment_date) <> EXTRACT(MONTH FROM (r.appointment_date + INTERVAL '7 days')) THEN
            v_reserved := 0;
        ELSE
            v_reserved := CEIL(v_total * 0.20);
        END IF;

        -- Promove se houver vaga
        IF (r.is_retorno = TRUE) THEN
            IF v_available >= r.quantity THEN
                UPDATE public.consultas_agendamentos
                SET status = 'Retorno'
                WHERE id = r.id;
            END IF;
        ELSIF (r.priority = 'Normal') THEN
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

-- 5. Atualiza o trigger BEFORE para incluir 'Solicitado' como consumidor de vaga e tratar 'Fila de espera'
CREATE OR REPLACE FUNCTION handle_consultas_vagas_change()
RETURNS TRIGGER AS $$
DECLARE
    v_available INTEGER;
    v_total INTEGER;
    v_reserved INTEGER;
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

            -- Se for Retorno, verifica apenas se há pelo menos NEW.quantity vagas gerais
            IF (NEW.status = 'Retorno') THEN
                IF v_available < NEW.quantity THEN
                    NEW.status := 'Fila de espera';
                END IF;
            ELSE
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

            -- Se for Retorno, verifica apenas se há pelo menos NEW.quantity vagas gerais
            IF (NEW.status = 'Retorno') THEN
                IF v_available < NEW.quantity THEN
                    NEW.status := 'Fila de espera';
                END IF;
            ELSE
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

                -- Se for Retorno, ignora a reserva de 20%
                IF (NEW.status = 'Retorno') THEN
                    IF (v_available + OLD.quantity) < NEW.quantity THEN
                        RAISE EXCEPTION 'Vagas esgotadas para este procedimento.';
                    END IF;
                ELSE
                    IF EXTRACT(MONTH FROM NEW.appointment_date) <> EXTRACT(MONTH FROM (NEW.appointment_date + INTERVAL '7 days')) THEN
                        v_reserved := 0;
                    ELSE
                        v_reserved := CEIL(v_total * 0.20);
                    END IF;

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

-- 6. Atualiza o trigger AFTER para incluir 'Solicitado' como consumidor e tratar 'Fila de espera'
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
        -- Se liberou vaga (deixou de ocupar, ou reduziu qtde)
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

-- 7. Recria os triggers para garantir que estão ativos e associados às funções corretas
DROP TRIGGER IF EXISTS trigger_handle_consultas_vagas ON public.consultas_agendamentos;
CREATE TRIGGER trigger_handle_consultas_vagas
    BEFORE INSERT OR UPDATE OR DELETE ON public.consultas_agendamentos
    FOR EACH ROW EXECUTE FUNCTION handle_consultas_vagas_change();

DROP TRIGGER IF EXISTS trigger_handle_consultas_vagas_after ON public.consultas_agendamentos;
CREATE TRIGGER trigger_handle_consultas_vagas_after
    AFTER UPDATE OR DELETE ON public.consultas_agendamentos
    FOR EACH ROW EXECUTE FUNCTION handle_consultas_vagas_after_change();

-- 8. Função e trigger para processamento automático da fila ao alterar vagas do procedimento
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
