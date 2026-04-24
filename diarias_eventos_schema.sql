-- Execute este script no SQL Editor do Supabase para criar a tabela de Lançamentos de Novos Eventos
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

-- Ativar RLS (Row Level Security)
ALTER TABLE public.diarias_eventos ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
-- Permitir que qualquer usuário autenticado insira registros
CREATE POLICY "Enable insert for authenticated users" ON public.diarias_eventos
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Permitir que usuários autenticados vejam os eventos do seu setor ou todos se necessário
-- Ajustar conforme a regra de visibilidade (ex: visível se do mesmo setor ou se o setor for vazio)
CREATE POLICY "Enable read access for authenticated users" ON public.diarias_eventos
    FOR SELECT USING (auth.role() = 'authenticated');

-- Permitir atualização/exclusão pelo criador, se necessário futuramente
CREATE POLICY "Enable update for users based on user_id" ON public.diarias_eventos
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Enable delete for users based on user_id" ON public.diarias_eventos
    FOR DELETE USING (auth.uid() = user_id);
