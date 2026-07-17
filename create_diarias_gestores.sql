-- Criar tabela para mapeamento de gestores das pessoas para diárias
CREATE TABLE IF NOT EXISTS public.diarias_gestores (
    pessoa_id UUID NOT NULL PRIMARY KEY REFERENCES public.persons(id) ON DELETE CASCADE,
    gestor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS
ALTER TABLE public.diarias_gestores ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
CREATE POLICY "Permitir leitura de gestores para usuários autenticados" 
ON public.diarias_gestores
FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Permitir gerenciamento de gestores para administradores" 
ON public.diarias_gestores
FOR ALL 
USING (auth.role() = 'authenticated');
