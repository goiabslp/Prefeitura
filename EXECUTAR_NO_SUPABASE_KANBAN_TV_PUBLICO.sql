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
-- Permite entrega otimizada e blindada dos processos do Kanban TV mesmo em caso de variações de RLS
CREATE OR REPLACE FUNCTION public.get_licitacao_kanban_tv()
RETURNS TABLE (
  id uuid,
  protocolo text,
  finalidade text,
  prioridade text,
  solicitante_nome text,
  solicitante_cargo text,
  solicitante_setor text,
  status text,
  criado_por uuid,
  criado_em timestamptz,
  atualizado_em timestamptz,
  fase text,
  ficha_orcamentaria text,
  resolucao_descricao text,
  resolucao_numero text,
  checkin_finalizado boolean,
  aprovado_em timestamptz,
  enviado_kanban_em timestamptz,
  apresentado_animacao boolean,
  oculto_kanban_view boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT 
    lp.id,
    lp.protocolo,
    lp.finalidade,
    lp.prioridade,
    lp.solicitante_nome,
    lp.solicitante_cargo,
    lp.solicitante_setor,
    lp.status,
    lp.criado_por,
    lp.criado_em,
    lp.atualizado_em,
    lp.fase,
    lp.ficha_orcamentaria,
    lp.resolucao_descricao,
    lp.resolucao_numero,
    lp.checkin_finalizado,
    lp.aprovado_em,
    lp.enviado_kanban_em,
    lp.apresentado_animacao,
    lp.oculto_kanban_view
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
