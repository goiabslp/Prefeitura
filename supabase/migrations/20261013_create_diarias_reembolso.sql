-- Criação da tabela para persistência individual de cada despesa de reembolso vinculada à solicitação
CREATE TABLE IF NOT EXISTS public.diarias_reembolso_despesas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    solicitacao_id TEXT NOT NULL,
    descricao TEXT NOT NULL,
    valor NUMERIC(12, 2) NOT NULL CHECK (valor > 0),
    data_despesa DATE,
    comprovantes JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Índices de consulta rápida
CREATE INDEX IF NOT EXISTS idx_diarias_reembolso_solicitacao ON public.diarias_reembolso_despesas(solicitacao_id);
CREATE INDEX IF NOT EXISTS idx_diarias_reembolso_data ON public.diarias_reembolso_despesas(data_despesa);

-- Habilitar RLS
ALTER TABLE public.diarias_reembolso_despesas ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
CREATE POLICY "Permitir leitura pública autenticada de despesas" 
ON public.diarias_reembolso_despesas FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Permitir inserção de despesas para autenticados" 
ON public.diarias_reembolso_despesas FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Permitir atualização de despesas para autenticados" 
ON public.diarias_reembolso_despesas FOR UPDATE 
TO authenticated 
USING (true);

CREATE POLICY "Permitir exclusão de despesas para autenticados" 
ON public.diarias_reembolso_despesas FOR DELETE 
TO authenticated 
USING (true);
