-- Script de Criação: Módulo de Licitação Independente

-- Tabela: licitacao_processos
CREATE TABLE IF NOT EXISTS public.licitacao_processos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    protocolo TEXT UNIQUE NOT NULL,
    finalidade TEXT NOT NULL,
    prioridade TEXT NOT NULL CHECK (prioridade IN ('Urgente', 'Normal')),
    solicitante_nome TEXT NOT NULL,
    solicitante_cargo TEXT NOT NULL,
    solicitante_setor TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Rascunho' CHECK (status IN ('Rascunho', 'Aguardando Assinatura', 'Assinado', 'Em Análise', 'Concluído', 'Rejeitado')),
    criado_por UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

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

-- Políticas Processos
CREATE POLICY "Visualização de Processos" ON public.licitacao_processos
    FOR SELECT USING (true); -- Controle frontend e admin backend mais robusto necessário em prod

CREATE POLICY "Inserção de Processos" ON public.licitacao_processos
    FOR INSERT WITH CHECK (auth.uid() = criado_por);

CREATE POLICY "Atualização de Processos" ON public.licitacao_processos
    FOR UPDATE USING (auth.uid() = criado_por OR EXISTS (SELECT 1 FROM public.licitacao_permissoes WHERE usuario_id = auth.uid() AND tipo_permissao = 'admin'));

-- Políticas Itens
CREATE POLICY "Acesso Total Itens" ON public.licitacao_itens FOR ALL USING (true);
CREATE POLICY "Acesso Total Justificativas" ON public.licitacao_justificativas FOR ALL USING (true);
CREATE POLICY "Acesso Total Assinaturas" ON public.licitacao_assinaturas FOR ALL USING (true);
CREATE POLICY "Acesso Total Permissoes" ON public.licitacao_permissoes FOR ALL USING (true);

-- Função Atualização de Timestamp
CREATE OR REPLACE FUNCTION update_licitacao_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.atualizado_em = timezone('utc'::text, now());
   RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_licitacao_processos_modtime
BEFORE UPDATE ON public.licitacao_processos
FOR EACH ROW EXECUTE PROCEDURE update_licitacao_updated_at_column();
