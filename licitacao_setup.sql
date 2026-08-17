-- Script de Criação/Atualização: Módulo de Licitação Independente

-- Tabela: licitacao_processos
CREATE TABLE IF NOT EXISTS public.licitacao_processos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    protocolo TEXT UNIQUE NOT NULL,
    finalidade TEXT NOT NULL,
    prioridade TEXT NOT NULL CHECK (prioridade IN ('Urgente', 'Normal')),
    solicitante_nome TEXT NOT NULL,
    solicitante_cargo TEXT NOT NULL,
    solicitante_setor TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Rascunho' CHECK (status IN ('Rascunho', 'Aguardando Assinatura', 'Assinado', 'Em Análise', 'Concluído', 'Finalizado', 'Rejeitado')),
    criado_por UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    fase TEXT,
    checkin_finalizado JSONB DEFAULT '{}'::jsonb
);

-- Garantir colunas adicionais caso a tabela já existisse previamente
ALTER TABLE public.licitacao_processos ADD COLUMN IF NOT EXISTS fase TEXT;
ALTER TABLE public.licitacao_processos ADD COLUMN IF NOT EXISTS checkin_finalizado JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.licitacao_processos ADD COLUMN IF NOT EXISTS aprovado_em TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.licitacao_processos ADD COLUMN IF NOT EXISTS enviado_kanban_em TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.licitacao_processos ADD COLUMN IF NOT EXISTS apresentado_animacao BOOLEAN DEFAULT FALSE;
ALTER TABLE public.licitacao_processos ADD COLUMN IF NOT EXISTS oculto_kanban_view BOOLEAN DEFAULT FALSE;
ALTER TABLE public.licitacao_processos DROP CONSTRAINT IF EXISTS licitacao_processos_status_check;
ALTER TABLE public.licitacao_processos ADD CONSTRAINT licitacao_processos_status_check CHECK (status IN ('Rascunho', 'Aguardando Assinatura', 'Assinado', 'Em Análise', 'Concluído', 'Finalizado', 'Rejeitado'));

-- Tabela: licitacao_itens
CREATE TABLE IF NOT EXISTS public.licitacao_itens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    processo_id UUID NOT NULL REFERENCES public.licitacao_processos(id) ON DELETE CASCADE,
    descricao TEXT NOT NULL,
    quantidade NUMERIC NOT NULL CHECK (quantidade > 0),
    observacoes TEXT,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabela: licitacao_justificativas
CREATE TABLE IF NOT EXISTS public.licitacao_justificativas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    processo_id UUID NOT NULL REFERENCES public.licitacao_processos(id) ON DELETE CASCADE UNIQUE,
    texto TEXT NOT NULL,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabela: licitacao_assinaturas
CREATE TABLE IF NOT EXISTS public.licitacao_assinaturas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    processo_id UUID NOT NULL REFERENCES public.licitacao_processos(id) ON DELETE CASCADE,
    usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    data_assinatura TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    hash_assinatura TEXT NOT NULL,
    ip_address TEXT,
    UNIQUE(processo_id, usuario_id)
);

-- Tabela: licitacao_permissoes (Regras extras de perfis do módulo)
CREATE TABLE IF NOT EXISTS public.licitacao_permissoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    tipo_permissao TEXT NOT NULL DEFAULT 'comum' CHECK (tipo_permissao IN ('admin', 'aprovador', 'comum')),
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Row Level Security (RLS) - Básicas
ALTER TABLE public.licitacao_processos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.licitacao_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.licitacao_justificativas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.licitacao_assinaturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.licitacao_permissoes ENABLE ROW LEVEL SECURITY;

-- Políticas Processos (Remoção prévia para permitir re-execução segura)
DROP POLICY IF EXISTS "Visualização de Processos" ON public.licitacao_processos;
CREATE POLICY "Visualização de Processos" ON public.licitacao_processos FOR SELECT USING (true);

DROP POLICY IF EXISTS "Inserção de Processos" ON public.licitacao_processos;
CREATE POLICY "Inserção de Processos" ON public.licitacao_processos FOR INSERT WITH CHECK (auth.uid() = criado_por);

DROP POLICY IF EXISTS "Atualização de Processos" ON public.licitacao_processos;
CREATE POLICY "Atualização de Processos" ON public.licitacao_processos FOR UPDATE USING (true);

-- Políticas Itens (Remoção prévia)
DROP POLICY IF EXISTS "Acesso Total Itens" ON public.licitacao_itens;
CREATE POLICY "Acesso Total Itens" ON public.licitacao_itens FOR ALL USING (true);

DROP POLICY IF EXISTS "Acesso Total Justificativas" ON public.licitacao_justificativas;
CREATE POLICY "Acesso Total Justificativas" ON public.licitacao_justificativas FOR ALL USING (true);

DROP POLICY IF EXISTS "Acesso Total Assinaturas" ON public.licitacao_assinaturas;
CREATE POLICY "Acesso Total Assinaturas" ON public.licitacao_assinaturas FOR ALL USING (true);

DROP POLICY IF EXISTS "Acesso Total Permissoes" ON public.licitacao_permissoes;
CREATE POLICY "Acesso Total Permissoes" ON public.licitacao_permissoes FOR ALL USING (true);

-- Função Atualização de Timestamp
CREATE OR REPLACE FUNCTION update_licitacao_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.atualizado_em = timezone('utc'::text, now());
   RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_licitacao_processos_modtime ON public.licitacao_processos;
CREATE TRIGGER update_licitacao_processos_modtime
BEFORE UPDATE ON public.licitacao_processos
FOR EACH ROW EXECUTE PROCEDURE update_licitacao_updated_at_column();
