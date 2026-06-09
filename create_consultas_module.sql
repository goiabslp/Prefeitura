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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Table: consultas_procedimentos
CREATE TABLE IF NOT EXISTS public.consultas_procedimentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('Exame', 'Consulta')),
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
    status TEXT NOT NULL DEFAULT 'Agendado' CHECK (status IN ('Agendado', 'Realizado', 'Cancelado')),
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
CREATE OR REPLACE FUNCTION handle_consultas_vagas_change()
RETURNS TRIGGER AS $$
DECLARE
    v_available INTEGER;
    v_total INTEGER;
    v_reserved INTEGER;
BEGIN
    IF (TG_OP = 'INSERT') THEN
        IF (NEW.status = 'Agendado') THEN
            -- Get available and total quantity
            SELECT available_quantity, total_quantity INTO v_available, v_total
            FROM public.consultas_procedimentos
            WHERE id = NEW.procedimento_id;

            -- Calculate reserved slots (20%) - bypass in the last week of the month
            IF EXTRACT(MONTH FROM NEW.appointment_date) <> EXTRACT(MONTH FROM (NEW.appointment_date + INTERVAL '7 days')) THEN
                v_reserved := 0;
            ELSE
                v_reserved := CEIL(v_total * 0.20);
            END IF;

            -- Validate based on priority
            IF (NEW.priority = 'Normal') THEN
                IF v_available < (v_reserved + NEW.quantity) THEN
                    RAISE EXCEPTION 'Vagas normais esgotadas para este procedimento. Vagas restantes reservadas para Urgência.';
                END IF;
            ELSE
                IF v_available < NEW.quantity THEN
                    RAISE EXCEPTION 'Vagas esgotadas para este procedimento.';
                END IF;
            END IF;

            UPDATE public.consultas_procedimentos
            SET available_quantity = available_quantity - NEW.quantity
            WHERE id = NEW.procedimento_id;
        END IF;

    ELSIF (TG_OP = 'UPDATE') THEN
        -- If status changed to Cancelado (return vagas)
        IF (OLD.status = 'Agendado' AND NEW.status = 'Cancelado') THEN
            UPDATE public.consultas_procedimentos
            SET available_quantity = available_quantity + OLD.quantity
            WHERE id = OLD.procedimento_id;
        
        -- If status changed back from Cancelado to Agendado
        ELSIF (OLD.status = 'Cancelado' AND NEW.status = 'Agendado') THEN
            SELECT available_quantity, total_quantity INTO v_available, v_total
            FROM public.consultas_procedimentos
            WHERE id = NEW.procedimento_id;

            -- Calculate reserved slots (20%) - bypass in the last week of the month
            IF EXTRACT(MONTH FROM NEW.appointment_date) <> EXTRACT(MONTH FROM (NEW.appointment_date + INTERVAL '7 days')) THEN
                v_reserved := 0;
            ELSE
                v_reserved := CEIL(v_total * 0.20);
            END IF;

            IF (NEW.priority = 'Normal') THEN
                IF v_available < (v_reserved + NEW.quantity) THEN
                    RAISE EXCEPTION 'Vagas normais esgotadas para este procedimento. Vagas restantes reservadas para Urgência.';
                END IF;
            ELSE
                IF v_available < NEW.quantity THEN
                    RAISE EXCEPTION 'Vagas esgotadas para este procedimento.';
                END IF;
            END IF;

            UPDATE public.consultas_procedimentos
            SET available_quantity = available_quantity - NEW.quantity
            WHERE id = NEW.procedimento_id;
        
        -- If quantity or priority changed for an active booking
        ELSIF (OLD.status = 'Agendado' AND NEW.status = 'Agendado' AND (OLD.quantity <> NEW.quantity OR OLD.priority <> NEW.priority)) THEN
            SELECT available_quantity, total_quantity INTO v_available, v_total
            FROM public.consultas_procedimentos
            WHERE id = NEW.procedimento_id;

            -- Calculate reserved slots (20%) - bypass in the last week of the month
            IF EXTRACT(MONTH FROM NEW.appointment_date) <> EXTRACT(MONTH FROM (NEW.appointment_date + INTERVAL '7 days')) THEN
                v_reserved := 0;
            ELSE
                v_reserved := CEIL(v_total * 0.20);
            END IF;

            -- Check availability as if the old slots were returned first
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

    ELSIF (TG_OP = 'DELETE') THEN
        IF (OLD.status = 'Agendado') THEN
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
