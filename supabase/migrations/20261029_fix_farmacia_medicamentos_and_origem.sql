-- ==============================================================================
-- Migração: Garantir colunas de Procedência/Origem e Alto Custo na Farmácia Popular
-- ==============================================================================

-- 1. Campos na tabela farmacia_medicamentos
ALTER TABLE public.farmacia_medicamentos 
ADD COLUMN IF NOT EXISTS alto_custo BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS origem TEXT,
ADD COLUMN IF NOT EXISTS doador_nome TEXT,
ADD COLUMN IF NOT EXISTS documento_origem TEXT;

-- Restrição de valores permitidos para a coluna origem em medicamentos
ALTER TABLE public.farmacia_medicamentos DROP CONSTRAINT IF EXISTS farmacia_medicamentos_origem_check;
ALTER TABLE public.farmacia_medicamentos ADD CONSTRAINT farmacia_medicamentos_origem_check 
CHECK (origem IS NULL OR origem IN ('COMPRADO', 'DOADO', 'FORNECIDO PELO ESTADO'));

COMMENT ON COLUMN public.farmacia_medicamentos.origem IS 'Origem do lote de estoque: COMPRADO, DOADO ou FORNECIDO PELO ESTADO';
COMMENT ON COLUMN public.farmacia_medicamentos.doador_nome IS 'Nome do município/entidade doadora ou órgão estadual responsável';
COMMENT ON COLUMN public.farmacia_medicamentos.documento_origem IS 'Documento de aquisição, termo de doação, ofício, nota fiscal ou guia SES';

-- 2. Campos na tabela farmacia_movimentacoes
ALTER TABLE public.farmacia_movimentacoes
ADD COLUMN IF NOT EXISTS origem TEXT,
ADD COLUMN IF NOT EXISTS doador_nome TEXT,
ADD COLUMN IF NOT EXISTS documento_origem TEXT;

-- Restrição de valores permitidos para a coluna origem em movimentações
ALTER TABLE public.farmacia_movimentacoes DROP CONSTRAINT IF EXISTS farmacia_movimentacoes_origem_check;
ALTER TABLE public.farmacia_movimentacoes ADD CONSTRAINT farmacia_movimentacoes_origem_check 
CHECK (origem IS NULL OR origem IN ('COMPRADO', 'DOADO', 'FORNECIDO PELO ESTADO'));

COMMENT ON COLUMN public.farmacia_movimentacoes.origem IS 'Origem da entrada: COMPRADO, DOADO ou FORNECIDO PELO ESTADO';
COMMENT ON COLUMN public.farmacia_movimentacoes.doador_nome IS 'Entidade doadora ou órgão estadual na movimentação';
COMMENT ON COLUMN public.farmacia_movimentacoes.documento_origem IS 'Documento comprobatório da entrada';

