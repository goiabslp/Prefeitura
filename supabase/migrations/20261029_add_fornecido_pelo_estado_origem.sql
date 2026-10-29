-- ==============================================================================
-- Migração: Adicionar opção 'FORNECIDO PELO ESTADO' na origem do estoque
-- ==============================================================================

-- 1. Atualizar constraint na tabela farmacia_medicamentos
ALTER TABLE public.farmacia_medicamentos 
DROP CONSTRAINT IF EXISTS farmacia_medicamentos_origem_check;

ALTER TABLE public.farmacia_medicamentos 
ADD CONSTRAINT farmacia_medicamentos_origem_check 
CHECK (origem IN ('COMPRADO', 'DOADO', 'FORNECIDO PELO ESTADO'));

-- 2. Atualizar constraint na tabela farmacia_movimentacoes
ALTER TABLE public.farmacia_movimentacoes 
DROP CONSTRAINT IF EXISTS farmacia_movimentacoes_origem_check;

ALTER TABLE public.farmacia_movimentacoes 
ADD CONSTRAINT farmacia_movimentacoes_origem_check 
CHECK (origem IN ('COMPRADO', 'DOADO', 'FORNECIDO PELO ESTADO'));

NOTIFY pgrst, 'reload schema';

