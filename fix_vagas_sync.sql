-- Migration: Sincronização Dinâmica e Fiel de Vagas dos Procedimentos
--
-- Executar este script no Editor SQL do Supabase.
--

-- 1. Criar a função centralizada de recálculo dinâmico
CREATE OR REPLACE FUNCTION public.recalculate_procedimento_vagas(p_procedimento_id UUID)
RETURNS VOID AS $$
DECLARE
    v_total INTEGER;
    v_active_bookings INTEGER;
    v_available INTEGER;
BEGIN
    -- Conta o total de slots cadastrados na tabela consultas_vagas
    SELECT COUNT(*) INTO v_total
    FROM public.consultas_vagas
    WHERE procedimento_id = p_procedimento_id;

    -- Soma as vagas ocupadas pelos agendamentos ativos
    SELECT COALESCE(SUM(quantity), 0) INTO v_active_bookings
    FROM public.consultas_agendamentos
    WHERE procedimento_id = p_procedimento_id
      AND status IN ('Solicitado', 'Agendado', 'Aguardando Data', 'Realizado', 'Retorno');

    -- Vagas disponíveis é a diferença (nunca menor que zero)
    v_available := GREATEST(0, v_total - v_active_bookings);

    -- Atualiza o procedimento correspondente
    UPDATE public.consultas_procedimentos
    SET total_quantity = v_total,
        available_quantity = v_available
    WHERE id = p_procedimento_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Executar recálculo corretivo inicial para todos os procedimentos existentes
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id FROM public.consultas_procedimentos LOOP
        PERFORM public.recalculate_procedimento_vagas(r.id);
    END LOOP;
END $$;

-- 3. Atualizar trigger na tabela public.consultas_vagas (AFTER INSERT OR DELETE)
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

-- Garantir que o trigger de consultas_vagas está ativo e associado à função atualizada
DROP TRIGGER IF EXISTS trigger_sync_procedimentos_vagas_count ON public.consultas_vagas;
CREATE TRIGGER trigger_sync_procedimentos_vagas_count
AFTER INSERT OR DELETE ON public.consultas_vagas
FOR EACH ROW EXECUTE FUNCTION public.sync_procedimentos_vagas_count();

-- 4. Atualizar o trigger BEFORE na tabela public.consultas_agendamentos
-- (Valida e direciona para Fila de Espera, mas NÃO atualiza o saldo diretamente)
CREATE OR REPLACE FUNCTION handle_consultas_vagas_change()
RETURNS TRIGGER AS $$
DECLARE
    v_available INTEGER;
    v_total INTEGER;
    v_reserved INTEGER;
    v_old_occupies BOOLEAN := FALSE;
    v_new_occupies BOOLEAN := FALSE;
    v_effective_available INTEGER;
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

    -- Validações antes de inserir ou atualizar
    IF (TG_OP = 'INSERT' AND v_new_occupies) THEN
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

    ELSIF (TG_OP = 'UPDATE') THEN
        -- Caso 1: De não-ocupante para ocupante de vaga
        IF (NOT v_old_occupies AND v_new_occupies) THEN
            SELECT available_quantity, total_quantity INTO v_available, v_total
            FROM public.consultas_procedimentos
            WHERE id = NEW.procedimento_id;

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

        -- Caso 2: Ambos ocupam, mas detalhes mudaram (quantidade, prioridade ou data)
        ELSIF (v_old_occupies AND v_new_occupies) THEN
            IF (OLD.quantity <> NEW.quantity OR OLD.priority <> NEW.priority OR OLD.appointment_date <> NEW.appointment_date) THEN
                SELECT available_quantity, total_quantity INTO v_available, v_total
                FROM public.consultas_procedimentos
                WHERE id = NEW.procedimento_id;

                -- Calcula vagas disponíveis temporariamente considerando a liberação da vaga antiga
                v_effective_available := v_available + OLD.quantity;

                -- Se for Retorno, ignora a reserva de 20%
                IF (NEW.status = 'Retorno') THEN
                    IF v_effective_available < NEW.quantity THEN
                        RAISE EXCEPTION 'Vagas esgotadas para este procedimento.';
                    END IF;
                ELSE
                    IF EXTRACT(MONTH FROM NEW.appointment_date) <> EXTRACT(MONTH FROM (NEW.appointment_date + INTERVAL '7 days')) THEN
                        v_reserved := 0;
                    ELSE
                        v_reserved := CEIL(v_total * 0.20);
                    END IF;

                    IF (NEW.priority = 'Normal') THEN
                        IF v_effective_available < (v_reserved + NEW.quantity) THEN
                            RAISE EXCEPTION 'Vagas normais esgotadas para este procedimento. Vagas restantes reservadas para Urgência.';
                        END IF;
                    ELSE
                        IF v_effective_available < NEW.quantity THEN
                            RAISE EXCEPTION 'Vagas esgotadas para este procedimento.';
                        END IF;
                    END IF;
                END IF;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Atualizar o trigger AFTER na tabela public.consultas_agendamentos
-- (Executa o recálculo e gerencia o processamento da fila de espera em cascata)
CREATE OR REPLACE FUNCTION handle_consultas_vagas_after_change()
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

-- 6. Recriar triggers de consultas_agendamentos associando-os às funções corretas
DROP TRIGGER IF EXISTS trigger_handle_consultas_vagas ON public.consultas_agendamentos;
CREATE TRIGGER trigger_handle_consultas_vagas
    BEFORE INSERT OR UPDATE ON public.consultas_agendamentos
    FOR EACH ROW EXECUTE FUNCTION handle_consultas_vagas_change();

DROP TRIGGER IF EXISTS trigger_handle_consultas_vagas_after ON public.consultas_agendamentos;
CREATE TRIGGER trigger_handle_consultas_vagas_after
    AFTER INSERT OR UPDATE OR DELETE ON public.consultas_agendamentos
    FOR EACH ROW EXECUTE FUNCTION handle_consultas_vagas_after_change();
