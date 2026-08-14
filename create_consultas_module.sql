-- Migration: Create Consultas tables (Pacientes, Procedimentos, Agendamentos)

-- 1. Table: consultas_pacientes
CREATE TABLE IF NOT EXISTS public.consultas_pacientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    nickname TEXT,
    cpf TEXT NOT NULL UNIQUE,
    birth_date DATE NOT NULL,
    phone TEXT,
    neighborhood TEXT,
    street TEXT,
    city TEXT DEFAULT 'SÃO JOSÉ DO GOIABAL -MG',
    sus_number TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Table: consultas_procedimentos
CREATE TABLE IF NOT EXISTS public.consultas_procedimentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('Exame', 'Consulta', 'Cirurgia')),
    total_quantity INTEGER NOT NULL DEFAULT 0 CHECK (total_quantity >= 0),
    available_quantity INTEGER NOT NULL DEFAULT 0 CHECK (available_quantity >= 0),
    status TEXT NOT NULL DEFAULT 'Ativo' CHECK (status IN ('Ativo', 'Inativo')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Table: consultas_agendamentos
CREATE TABLE IF NOT EXISTS public.consultas_agendamentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES public.consultas_pacientes(id) ON DELETE RESTRICT,
    procedimento_id UUID NOT NULL REFERENCES public.consultas_procedimentos(id) ON DELETE RESTRICT,
    appointment_date DATE NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    priority TEXT NOT NULL DEFAULT 'Normal' CHECK (priority IN ('Normal', 'Urgência')),
    status TEXT NOT NULL DEFAULT 'Solicitado' CHECK (status IN ('Solicitado', 'Agendado', 'Realizado', 'Cancelado', 'Não Realizado', 'Fila de espera', 'Aguardando Data')),
    created_by UUID NOT NULL REFERENCES public.profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Constraint for Conflict Prevention (Only one active booking per patient, procedure, and day)
CREATE UNIQUE INDEX IF NOT EXISTS unique_active_appointment 
ON public.consultas_agendamentos (patient_id, procedimento_id, appointment_date) 
WHERE (status = 'Agendado');

-- 5. Create RLS Policies
ALTER TABLE public.consultas_pacientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultas_procedimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultas_agendamentos ENABLE ROW LEVEL SECURITY;

-- Policies for consultas_pacientes
CREATE POLICY "Allow read access to authenticated users on consultas_pacientes"
ON public.consultas_pacientes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow write access to authenticated users on consultas_pacientes"
ON public.consultas_pacientes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Policies for consultas_procedimentos
CREATE POLICY "Allow read access to authenticated users on consultas_procedimentos"
ON public.consultas_procedimentos FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow write access to authenticated users on consultas_procedimentos"
ON public.consultas_procedimentos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Policies for consultas_agendamentos
CREATE POLICY "Allow read access to authenticated users on consultas_agendamentos"
ON public.consultas_agendamentos FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow write access to authenticated users on consultas_agendamentos"
ON public.consultas_agendamentos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 6. Trigger for updated_at column
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_consultas_pacientes_modtime
    BEFORE UPDATE ON public.consultas_pacientes
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_consultas_procedimentos_modtime
    BEFORE UPDATE ON public.consultas_procedimentos
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- 7. Trigger for auto-managing vagas (available slots) on agendamentos table
CREATE OR REPLACE FUNCTION public.processar_fila_espera_consultas(p_procedimento_id UUID)
RETURNS VOID AS $$
DECLARE
    v_available INTEGER;
    v_total INTEGER;
    v_reserved INTEGER;
    r RECORD;
BEGIN
    FOR r IN 
        SELECT id, appointment_date, quantity, priority 
        FROM public.consultas_agendamentos
        WHERE procedimento_id = p_procedimento_id 
          AND status = 'Fila de espera'
        ORDER BY CASE WHEN priority = 'Urgência' THEN 0 ELSE 1 END ASC, created_at ASC
    LOOP
        SELECT available_quantity, total_quantity INTO v_available, v_total
        FROM public.consultas_procedimentos
        WHERE id = p_procedimento_id;

        IF EXTRACT(MONTH FROM r.appointment_date) <> EXTRACT(MONTH FROM (r.appointment_date + INTERVAL '7 days')) THEN
            v_reserved := 0;
        ELSE
            v_reserved := CEIL(v_total * 0.20);
        END IF;

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

            IF (NEW.status IN ('Solicitado', 'Agendado', 'Aguardando Data', 'Realizado')) THEN
                UPDATE public.consultas_procedimentos
                SET available_quantity = available_quantity - NEW.quantity
                WHERE id = NEW.procedimento_id;
            END IF;

        ELSIF (v_old_occupies AND NOT v_new_occupies) THEN
            UPDATE public.consultas_procedimentos
            SET available_quantity = available_quantity + OLD.quantity
            WHERE id = OLD.procedimento_id;

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

CREATE TRIGGER trigger_handle_consultas_vagas
    BEFORE INSERT OR UPDATE OR DELETE ON public.consultas_agendamentos
    FOR EACH ROW EXECUTE FUNCTION handle_consultas_vagas_change();

CREATE OR REPLACE FUNCTION handle_consultas_vagas_after_change()
RETURNS TRIGGER AS $$
DECLARE
    v_old_occupies BOOLEAN := FALSE;
    v_new_occupies BOOLEAN := FALSE;
BEGIN
    IF (TG_OP = 'UPDATE' OR TG_OP = 'DELETE') THEN
        v_old_occupies := OLD.status IN ('Solicitado', 'Agendado', 'Aguardando Data', 'Realizado');
    END IF;

    IF (TG_OP = 'UPDATE') THEN
        v_new_occupies := NEW.status IN ('Solicitado', 'Agendado', 'Aguardando Data', 'Realizado');
    END IF;

    IF (TG_OP = 'UPDATE') THEN
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

CREATE TRIGGER trigger_handle_consultas_vagas_after
    AFTER UPDATE OR DELETE ON public.consultas_agendamentos
    FOR EACH ROW EXECUTE FUNCTION handle_consultas_vagas_after_change();

CREATE OR REPLACE FUNCTION handle_procedimentos_vagas_after_change()
RETURNS TRIGGER AS $$
BEGIN
    IF (NEW.available_quantity > OLD.available_quantity) THEN
        PERFORM public.processar_fila_espera_consultas(NEW.id);
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_handle_procedimentos_vagas_after
    AFTER UPDATE ON public.consultas_procedimentos
    FOR EACH ROW EXECUTE FUNCTION handle_procedimentos_vagas_after_change();

-- 8. Add tables to Realtime publication
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.consultas_pacientes;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.consultas_procedimentos;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.consultas_agendamentos;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
