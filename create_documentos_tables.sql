-- ====================================================================
-- MIGRATION: MÓDULO DOCUMENTOS (FLUXO, TRAMITAÇÃO, MOVIMENTAÇÃO E AUDITORIA)
-- ====================================================================

-- 1. Tabela: documentos_fluxo
CREATE TABLE IF NOT EXISTS public.documentos_fluxo (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero_sequencial TEXT,
    tipo_documento TEXT NOT NULL,
    titulo TEXT NOT NULL,
    descricao TEXT,
    anexo_url TEXT,
    anexo_nome TEXT,
    anexo_tamanho BIGINT,
    
    -- Localização e Responsabilidade Atual
    setor_atual TEXT NOT NULL,
    responsavel_atual_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    responsavel_atual_nome TEXT,
    
    -- Status (onde está) e Fase (situação do documento)
    status TEXT NOT NULL,
    fase TEXT NOT NULL,
    
    -- Prazos Oficiais Persistidos (Timestamps)
    data_criacao TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    prazo_geral_limite TIMESTAMPTZ NOT NULL,
    data_etapa_inicio TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    prazo_etapa_limite TIMESTAMPTZ NOT NULL,
    
    -- Autoria e Conclusão
    criado_por_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    criado_por_nome TEXT,
    concluido BOOLEAN DEFAULT false,
    concluido_em TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Tabela: documentos_movimentacoes (Histórico imutável de movimentações)
CREATE TABLE IF NOT EXISTS public.documentos_movimentacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    documento_id UUID NOT NULL REFERENCES public.documentos_fluxo(id) ON DELETE CASCADE,
    origem_setor TEXT NOT NULL,
    origem_usuario_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    origem_usuario_nome TEXT,
    destino_setor TEXT NOT NULL,
    destino_usuario_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    destino_usuario_nome TEXT,
    responsavel_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    responsavel_nome TEXT,
    data_hora TEXT NOT NULL, -- Exemplo: "30/09/2026 10:29:35" com segundos
    timestamp_iso TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    status TEXT NOT NULL,
    fase TEXT NOT NULL,
    observacao TEXT NOT NULL,
    tipo_evento TEXT NOT NULL DEFAULT 'encaminhamento',
    anexo_url TEXT,
    anexo_nome TEXT,
    criado_por_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    criado_por_nome TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. Tabela: documentos_tipos (Tipos de documento cadastrados dinamicamente)
CREATE TABLE IF NOT EXISTS public.documentos_tipos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL UNIQUE,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- Inserir tipos pré-definidos se não existirem
INSERT INTO public.documentos_tipos (nome) VALUES
    ('Projeto de Lei'),
    ('Suplementação'),
    ('Requerimento'),
    ('Ofício'),
    ('Parecer'),
    ('Resposta'),
    ('Convênio'),
    ('Outros')
ON CONFLICT (nome) DO NOTHING;

-- 4. Índices para performance máxima de buscas e filtros
CREATE INDEX IF NOT EXISTS idx_docfluxo_setor_atual ON public.documentos_fluxo(setor_atual);
CREATE INDEX IF NOT EXISTS idx_docfluxo_responsavel ON public.documentos_fluxo(responsavel_atual_id);
CREATE INDEX IF NOT EXISTS idx_docfluxo_concluido ON public.documentos_fluxo(concluido);
CREATE INDEX IF NOT EXISTS idx_docfluxo_status ON public.documentos_fluxo(status);
CREATE INDEX IF NOT EXISTS idx_docfluxo_fase ON public.documentos_fluxo(fase);
CREATE INDEX IF NOT EXISTS idx_docmov_doc_id ON public.documentos_movimentacoes(documento_id);
CREATE INDEX IF NOT EXISTS idx_docmov_created ON public.documentos_movimentacoes(created_at);

-- 5. Row Level Security (RLS)
ALTER TABLE public.documentos_fluxo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documentos_movimentacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documentos_tipos ENABLE ROW LEVEL SECURITY;

-- Políticas para documentos_fluxo
DROP POLICY IF EXISTS "Permitir leitura de documentos autenticados" ON public.documentos_fluxo;
CREATE POLICY "Permitir leitura de documentos autenticados"
ON public.documentos_fluxo FOR SELECT
TO authenticated, anon
USING (true);

DROP POLICY IF EXISTS "Permitir criacao e atualizacao de documentos" ON public.documentos_fluxo;
CREATE POLICY "Permitir criacao e atualizacao de documentos"
ON public.documentos_fluxo FOR ALL
TO authenticated, anon
USING (true)
WITH CHECK (true);

-- Políticas para documentos_movimentacoes (Inserção e Leitura - imutabilidade)
DROP POLICY IF EXISTS "Permitir leitura de movimentacoes autenticados" ON public.documentos_movimentacoes;
CREATE POLICY "Permitir leitura de movimentacoes autenticados"
ON public.documentos_movimentacoes FOR SELECT
TO authenticated, anon
USING (true);

DROP POLICY IF EXISTS "Permitir criacao de movimentacoes" ON public.documentos_movimentacoes;
CREATE POLICY "Permitir criacao de movimentacoes"
ON public.documentos_movimentacoes FOR INSERT
TO authenticated, anon
WITH CHECK (true);

-- Políticas para documentos_tipos
DROP POLICY IF EXISTS "Permitir leitura e escrita em documentos_tipos" ON public.documentos_tipos;
CREATE POLICY "Permitir leitura e escrita em documentos_tipos"
ON public.documentos_tipos FOR ALL
TO authenticated, anon
USING (true)
WITH CHECK (true);

-- 6. Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION public.update_documentos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_documentos_fluxo ON public.documentos_fluxo;
CREATE TRIGGER trigger_update_documentos_fluxo
    BEFORE UPDATE ON public.documentos_fluxo
    FOR EACH ROW
    EXECUTE FUNCTION public.update_documentos_updated_at();

-- 7. Adicionar ao Supabase Realtime
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.documentos_fluxo;
ALTER PUBLICATION supabase_realtime ADD TABLE public.documentos_movimentacoes;
