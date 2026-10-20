-- Migration: Estrutura hierárquica de Procedimentos e Especialistas Vinculados
-- Permite que procedimentos filhos (especialistas) tenham parent_id referenciando consultas_procedimentos(id)
-- e flexibiliza a constraint de formato de código para aceitar códigos pais ('0397') e filhos ('0397-10', '0397-11', etc)

-- 1. Adicionar coluna parent_id referenciando consultas_procedimentos
ALTER TABLE public.consultas_procedimentos 
ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.consultas_procedimentos(id) ON DELETE RESTRICT;

-- 2. Atualizar a constraint de formato do código (code) para permitir códigos de 4 dígitos ou formato hierárquico (ex: 0397-10)
ALTER TABLE public.consultas_procedimentos 
DROP CONSTRAINT IF EXISTS consultas_procedimentos_code_check;

ALTER TABLE public.consultas_procedimentos 
ADD CONSTRAINT consultas_procedimentos_code_check 
CHECK (code ~ '^\d{4}(-\d+)?$');

-- 3. Adicionar índice em parent_id para otimização de consultas hierárquicas
CREATE INDEX IF NOT EXISTS idx_consultas_procedimentos_parent_id 
ON public.consultas_procedimentos(parent_id);

-- 4. Adicionar índice composto para busca de filhos por código
CREATE INDEX IF NOT EXISTS idx_consultas_procedimentos_code 
ON public.consultas_procedimentos(code);
