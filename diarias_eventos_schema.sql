-- Execute este script no SQL Editor do Supabase para criar a tabela e adicionar colunas de Lançamentos de Novos Eventos
CREATE TABLE IF NOT EXISTS public.diarias_eventos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    pessoas JSONB NOT NULL,
    destino VARCHAR(255) NOT NULL,
    data_saida TIMESTAMP WITH TIME ZONE NOT NULL,
    data_retorno TIMESTAMP WITH TIME ZONE NOT NULL,
    motivo TEXT NOT NULL,
    setor_id UUID REFERENCES public.sectors(id),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    user_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Garantir adição de todas as colunas de controle, hospedagem, veículo e distância
ALTER TABLE public.diarias_eventos
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'aguardando_gestor',
ADD COLUMN IF NOT EXISTS justificativa_gestor TEXT,
ADD COLUMN IF NOT EXISTS comprovantes_gestor JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS valor_diaria NUMERIC,
ADD COLUMN IF NOT EXISTS relatorio_viagem TEXT,
ADD COLUMN IF NOT EXISTS hospedagem BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS hospedagem_dias INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS veiculo VARCHAR(255),
ADD COLUMN IF NOT EXISTS veiculo_outro VARCHAR(255),
ADD COLUMN IF NOT EXISTS distancia NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS gestor_transferido_cargo VARCHAR(255);

-- Ativar RLS (Row Level Security)
ALTER TABLE public.diarias_eventos ENABLE ROW LEVEL SECURITY;

-- Limpeza de políticas existentes para evitar erros de duplicidade
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.diarias_eventos;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.diarias_eventos;
DROP POLICY IF EXISTS "Enable update for users based on user_id" ON public.diarias_eventos;
DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON public.diarias_eventos;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.diarias_eventos;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.diarias_eventos;

-- Políticas de RLS
-- Permitir que qualquer usuário insira registros
CREATE POLICY "Enable insert for authenticated users" ON public.diarias_eventos
    FOR INSERT WITH CHECK (true);

-- Permitir leitura para usuários
CREATE POLICY "Enable read access for authenticated users" ON public.diarias_eventos
    FOR SELECT USING (true);

-- Permitir atualização para usuários autenticados e administradores
CREATE POLICY "Enable update for authenticated users" ON public.diarias_eventos
    FOR UPDATE USING (true);

-- Permitir exclusão para usuários autenticados e administradores
CREATE POLICY "Enable delete for authenticated users" ON public.diarias_eventos
    FOR DELETE USING (true);
