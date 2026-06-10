-- Migration: Criação da tabela consultas_vagas e trigger de sincronização de cotas

CREATE TABLE IF NOT EXISTS public.consultas_vagas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    procedimento_id UUID NOT NULL REFERENCES public.consultas_procedimentos(id) ON DELETE CASCADE,
    data DATE NOT NULL,
    hora TIME NOT NULL,
    status TEXT NOT NULL DEFAULT 'Disponível' CHECK (status IN ('Disponível', 'Ocupada')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS (Row Level Security)
ALTER TABLE public.consultas_vagas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read access to authenticated users on consultas_vagas" ON public.consultas_vagas;
CREATE POLICY "Allow read access to authenticated users on consultas_vagas"
ON public.consultas_vagas FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow write access to authenticated users on consultas_vagas" ON public.consultas_vagas;
CREATE POLICY "Allow write access to authenticated users on consultas_vagas"
ON public.consultas_vagas FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Habilitar replicação em tempo real para consultas_vagas
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
          AND schemaname = 'public' 
          AND tablename = 'consultas_vagas'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.consultas_vagas;
    END IF;
END $$;

-- Trigger para sincronizar a quantidade de vagas em consultas_procedimentos
CREATE OR REPLACE FUNCTION public.sync_procedimentos_vagas_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.consultas_procedimentos
        SET total_quantity = total_quantity + 1,
            available_quantity = available_quantity + 1
        WHERE id = NEW.procedimento_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.consultas_procedimentos
        SET total_quantity = GREATEST(0, total_quantity - 1),
            available_quantity = GREATEST(0, available_quantity - 1)
        WHERE id = OLD.procedimento_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_sync_procedimentos_vagas_count ON public.consultas_vagas;
CREATE TRIGGER trigger_sync_procedimentos_vagas_count
AFTER INSERT OR DELETE ON public.consultas_vagas
FOR EACH ROW EXECUTE FUNCTION public.sync_procedimentos_vagas_count();
