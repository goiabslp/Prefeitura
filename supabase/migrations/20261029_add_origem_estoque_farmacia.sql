-- ==============================================================================
-- Migração: Adicionar campos de Procedência/Origem do Estoque na Farmácia Popular
-- ==============================================================================

-- 1. Campos de procedência na tabela de medicamentos/lotes
ALTER TABLE public.farmacia_medicamentos 
ADD COLUMN IF NOT EXISTS origem TEXT CHECK (origem IN ('COMPRADO', 'DOADO')),
ADD COLUMN IF NOT EXISTS doador_nome TEXT,
ADD COLUMN IF NOT EXISTS documento_origem TEXT;

COMMENT ON COLUMN public.farmacia_medicamentos.origem IS 'Origem do lote de estoque: COMPRADO ou DOADO';
COMMENT ON COLUMN public.farmacia_medicamentos.doador_nome IS 'Nome do município, entidade ou instituição doadora (obrigatório se DOADO)';
COMMENT ON COLUMN public.farmacia_medicamentos.documento_origem IS 'Documento de aquisição, termo de doação, ofício ou nota fiscal';

-- 2. Campos de procedência na tabela de histórico de movimentações
ALTER TABLE public.farmacia_movimentacoes
ADD COLUMN IF NOT EXISTS origem TEXT CHECK (origem IN ('COMPRADO', 'DOADO')),
ADD COLUMN IF NOT EXISTS doador_nome TEXT,
ADD COLUMN IF NOT EXISTS documento_origem TEXT;

COMMENT ON COLUMN public.farmacia_movimentacoes.origem IS 'Origem da entrada: COMPRADO ou DOADO';
COMMENT ON COLUMN public.farmacia_movimentacoes.doador_nome IS 'Município ou entidade doadora na movimentação';
COMMENT ON COLUMN public.farmacia_movimentacoes.documento_origem IS 'Documento comprobatório da entrada';

