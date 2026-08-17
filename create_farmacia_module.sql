-- Migration: Create Farmácia Popular tables (Medicamentos, Movimentações, Configurações)

-- 1. Table: farmacia_medicamentos
CREATE TABLE IF NOT EXISTS public.farmacia_medicamentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    categoria TEXT NOT NULL CHECK (categoria IN ('CBAF', 'CESAF', 'CEAF')),
    quantidade INTEGER NOT NULL DEFAULT 0 CHECK (quantidade >= 0),
    unidade TEXT NOT NULL,
    validade DATE NOT NULL,
    lote TEXT NOT NULL,
    limite_minimo INTEGER NOT NULL DEFAULT 10 CHECK (limite_minimo >= 0),
    tipo TEXT,
    dosagem TEXT,
    fornecedor TEXT,
    principio_ativo TEXT,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Table: farmacia_movimentacoes
CREATE TABLE IF NOT EXISTS public.farmacia_movimentacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    medicamento_id UUID REFERENCES public.farmacia_medicamentos(id) ON DELETE SET NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('Entrada', 'Saída', 'Ajuste')),
    quantidade INTEGER NOT NULL CHECK (quantidade > 0),
    medicamento_nome TEXT NOT NULL,
    medicamento_categoria TEXT NOT NULL CHECK (medicamento_categoria IN ('CBAF', 'CESAF', 'CEAF')),
    medicamento_tipo TEXT,
    medicamento_dosagem TEXT,
    lote TEXT NOT NULL,
    validade DATE NOT NULL,
    paciente_nome TEXT,
    paciente_cpf TEXT,
    medico_crm TEXT,
    medico_uf TEXT,
    medico_nome TEXT,
    medico_consulta_data TIMESTAMP WITH TIME ZONE,
    responsavel_nome TEXT NOT NULL,
    responsavel_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    data TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    observacoes TEXT,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Table: farmacia_config
CREATE TABLE IF NOT EXISTS public.farmacia_config (
    chave TEXT PRIMARY KEY,
    valor JSONB NOT NULL
);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.farmacia_medicamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.farmacia_movimentacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.farmacia_config ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
-- policies for farmacia_medicamentos
CREATE POLICY "Allow read access to authenticated users on farmacia_medicamentos"
ON public.farmacia_medicamentos FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow write access to authenticated users on farmacia_medicamentos"
ON public.farmacia_medicamentos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- policies for farmacia_movimentacoes
CREATE POLICY "Allow read access to authenticated users on farmacia_movimentacoes"
ON public.farmacia_movimentacoes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow write access to authenticated users on farmacia_movimentacoes"
ON public.farmacia_movimentacoes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- policies for farmacia_config
CREATE POLICY "Allow read access to authenticated users on farmacia_config"
ON public.farmacia_config FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow write access to authenticated users on farmacia_config"
ON public.farmacia_config FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 6. Trigger for atualizado_em column on farmacia_medicamentos
CREATE OR REPLACE FUNCTION update_farmacia_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.atualizado_em = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_farmacia_medicamentos_modtime
    BEFORE UPDATE ON public.farmacia_medicamentos
    FOR EACH ROW EXECUTE FUNCTION update_farmacia_modified_column();

-- 7. Add tables to Realtime publication
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.farmacia_medicamentos;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Enable for movimentacoes
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.farmacia_movimentacoes;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Enable for config
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.farmacia_config;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
