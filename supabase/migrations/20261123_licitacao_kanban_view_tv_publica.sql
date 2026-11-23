-- ============================================================================
-- PREFEITURA INTEGRADA — VISUALIZAÇÃO PÚBLICA DO KANBAN DE LICITAÇÕES NA TV
-- Data: 23 de Novembro de 2026
-- Rota: /Licitacao/Kanban/view
-- Objetivo:
--   1. Conceder permissão de leitura (SELECT) controlada para a role 'anon'
--      na tabela public.licitacao_processos e public.licitacao_itens.
--   2. Criar política RLS pública exclusiva para o Kanban da TV:
--      Apenas processos aprovados (status aprovado ou com aprovado_em preenchido),
--      não rejeitados, não rascunhos, e onde oculto_kanban_view IS NOT TRUE.
--   3. Criar política RLS em public.licitacao_itens para a role 'anon',
--      permitindo leitura dos itens vinculados a processos visíveis no Kanban TV.
--   4. Criar função RPC get_licitacao_kanban_tv() com SECURITY DEFINER para
--      fornecer leitura blindada, rápida e sem falhas para Smart TVs e abas anônimas.
-- ============================================================================

-- 1. CONCESSÃO DE PERMISSÃO SELECT NO SCHEMA E NAS TABELAS PARA A ROLE ANON
GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT ON TABLE public.licitacao_processos TO anon;
GRANT SELECT ON TABLE public.licitacao_itens TO anon;

-- 2. POLÍTICA RLS PARA A TABELA licitacao_processos (ROLE anon)
-- Permite que visitantes sem login visualizem no Kanban apenas processos aprovados que não estejam ocultos na TV
DROP POLICY IF EXISTS "licitacao_processos_select_public_tv" ON public.licitacao_processos;
CREATE POLICY "licitacao_processos_select_public_tv"
ON public.licitacao_processos
FOR SELECT
TO anon
USING (
  (status IN ('Aprovado', 'aprovado', 'Approved', 'approved') OR aprovado_em IS NOT NULL)
  AND (status NOT IN ('Rejeitado', 'rejeitado', 'Rejected', 'rejected', 'Rascunho', 'rascunho'))
  AND (oculto_kanban_view IS NOT TRUE)
);

-- 3. POLÍTICA RLS PARA A TABELA licitacao_itens (ROLE anon)
-- Permite leitura de itens apenas dos processos aprovados visíveis no Kanban TV
DROP POLICY IF EXISTS "licitacao_itens_select_public_tv" ON public.licitacao_itens;
CREATE POLICY "licitacao_itens_select_public_tv"
ON public.licitacao_itens
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.licitacao_processos lp
    WHERE lp.id = licitacao_itens.processo_id
      AND (lp.status IN ('Aprovado', 'aprovado', 'Approved', 'approved') OR lp.aprovado_em IS NOT NULL)
      AND (lp.status NOT IN ('Rejeitado', 'rejeitado', 'Rejected', 'rejected', 'Rascunho', 'rascunho'))
      AND (lp.oculto_kanban_view IS NOT TRUE)
  )
);

-- 4. FUNÇÃO RPC COM SECURITY DEFINER: get_licitacao_kanban_tv
-- Retorna diretamente o conjunto de registros da tabela licitacao_processos (SETOF public.licitacao_processos),
-- garantindo correspondência exata de tipos (evitando discrepâncias entre jsonb/boolean/text).
DROP FUNCTION IF EXISTS public.get_licitacao_kanban_tv();
CREATE OR REPLACE FUNCTION public.get_licitacao_kanban_tv()
RETURNS SETOF public.licitacao_processos
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT lp.*
  FROM public.licitacao_processos lp
  WHERE (lp.status IN ('Aprovado', 'aprovado', 'Approved', 'approved') OR lp.aprovado_em IS NOT NULL)
    AND (lp.status NOT IN ('Rejeitado', 'rejeitado', 'Rejected', 'rejected', 'Rascunho', 'rascunho'))
    AND (lp.oculto_kanban_view IS NOT TRUE)
  ORDER BY lp.criado_em DESC;
$$;

-- Permissões de execução para a RPC
GRANT EXECUTE ON FUNCTION public.get_licitacao_kanban_tv() TO anon;
GRANT EXECUTE ON FUNCTION public.get_licitacao_kanban_tv() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_licitacao_kanban_tv() TO service_role;

-- 5. RECARREGAR O SCHEMA CACHE DO POSTGREST
NOTIFY pgrst, 'reload schema';
