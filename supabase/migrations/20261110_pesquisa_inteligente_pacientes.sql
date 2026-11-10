-- ============================================================================
-- MIGRATION: PESQUISA INTELIGENTE DE PACIENTES (AUTOSENHA)
-- Data: 2026-11-10
-- Rotas relacionadas:
--   /AutoSenha/PSF1/Controle, /AutoSenha/PSF2, /AutoSenha/PSF2/Controle, /AutoSenha/UPA/Controle
-- Objetivo:
--   1. Criar função IMMUTABLE nativa normalize_paciente_search_text(text) ignorando
--      acentos e maiúsculas/minúsculas para busca por nome e apelido, sem
--      colidir com public.normalize_search_text(input_text text) de Compras.
--   2. Criar índices em nome normalizado, apelido normalizado e CNS em
--      public.consultas_pacientes.
--   3. Criar RPC buscar_pacientes_autosenha(p_termo, p_limit) somente leitura,
--      bloqueando anon e exigindo permissão em can_read_consultas_pacientes_integrados().
-- ============================================================================

-- 1. FUNÇÃO NATIVA DE NORMALIZAÇÃO ACENTO-INSENSÍVEL (DEDICADA A PACIENTES)
CREATE OR REPLACE FUNCTION public.normalize_paciente_search_text(p_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT regexp_replace(
        trim(
            translate(
                lower(COALESCE(p_text, '')),
                'áàãâäéèêëíìîïóòõôöúùûüçñýÿ',
                'aaaaaeeeeiiiiooooouuuucnyy'
            )
        ),
        '\s+',
        ' ',
        'g'
    );
$$;

-- 2. ÍNDICES DE PERFORMANCE PARA PESQUISA POR NOME, APELIDO E CNS
DO $$
BEGIN
    IF to_regclass('public.consultas_pacientes') IS NOT NULL THEN
        ALTER TABLE public.consultas_pacientes ADD COLUMN IF NOT EXISTS nickname TEXT;
        ALTER TABLE public.consultas_pacientes ADD COLUMN IF NOT EXISTS sus_number TEXT;

        CREATE INDEX IF NOT EXISTS idx_consultas_pacientes_name_norm
            ON public.consultas_pacientes (public.normalize_paciente_search_text(name));
        CREATE INDEX IF NOT EXISTS idx_consultas_pacientes_nickname_norm
            ON public.consultas_pacientes (public.normalize_paciente_search_text(nickname))
            WHERE nickname IS NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_consultas_pacientes_sus_norm
            ON public.consultas_pacientes (regexp_replace(COALESCE(sus_number, ''), '\D', '', 'g'))
            WHERE sus_number IS NOT NULL;
    END IF;
END $$;

-- 3. RPC SOMENTE LEITURA DE PESQUISA INTELIGENTE (PROTEGIDA CONTRA ANON)
DROP FUNCTION IF EXISTS public.buscar_pacientes_autosenha(text, int);

CREATE OR REPLACE FUNCTION public.buscar_pacientes_autosenha(
    p_termo text,
    p_limit int DEFAULT 20
)
RETURNS SETOF public.consultas_pacientes
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_raw text := trim(COALESCE(p_termo, ''));
    v_digits text := regexp_replace(COALESCE(p_termo, ''), '\D', '', 'g');
    v_norm text := public.normalize_paciente_search_text(p_termo);
    v_like text := replace(replace(replace(public.normalize_paciente_search_text(p_termo), '\', '\\'), '%', '\%'), '_', '\_');
    v_digits_like text := replace(replace(replace(regexp_replace(COALESCE(p_termo, ''), '\D', '', 'g'), '\', '\\'), '%', '\%'), '_', '\_');
    v_has_letters boolean := (v_raw ~ '[[:alpha:]]');
    v_limit int := LEAST(30, GREATEST(1, COALESCE(p_limit, 20)));
    v_tokens text[];
BEGIN
    -- Bloqueia acesso anônimo e usuários sem permissão de consulta integrada
    IF auth.role() <> 'service_role' THEN
        IF to_regprocedure('public.can_read_consultas_pacientes_integrados()') IS NULL THEN
            RAISE EXCEPTION 'Função de permissão can_read_consultas_pacientes_integrados() ausente. Execute 20261110_pacientes_cpf_unique_e_rls_autosenha.sql antes desta migração.'
                USING ERRCODE = '42501';
        END IF;

        IF auth.uid() IS NULL OR NOT public.can_read_consultas_pacientes_integrados() THEN
            RAISE EXCEPTION 'Acesso negado: usuário não autorizado a consultar pacientes.'
                USING ERRCODE = '42501';
        END IF;
    END IF;

    -- CPF exato (11 dígitos)
    IF NOT v_has_letters AND length(v_digits) = 11 THEN
        RETURN QUERY
        SELECT cp.*
          FROM public.consultas_pacientes cp
         WHERE regexp_replace(COALESCE(cp.cpf, ''), '\D', '', 'g') = v_digits
         LIMIT v_limit;
        RETURN;
    END IF;

    -- Cartão SUS / CNS exato (15 dígitos)
    IF NOT v_has_letters AND length(v_digits) = 15 THEN
        RETURN QUERY
        SELECT cp.*
          FROM public.consultas_pacientes cp
         WHERE regexp_replace(COALESCE(cp.sus_number, ''), '\D', '', 'g') = v_digits
         LIMIT v_limit;
        RETURN;
    END IF;

    -- Exige ao menos 3 caracteres para pesquisa textual / parcial
    IF length(v_norm) < 3 AND length(v_digits) < 3 THEN
        RETURN;
    END IF;

    v_tokens := regexp_split_to_array(v_norm, '\s+');

    RETURN QUERY
    SELECT cp.*
      FROM public.consultas_pacientes cp
     WHERE (
         (length(v_digits) >= 3 AND NOT v_has_letters AND (
             regexp_replace(COALESCE(cp.cpf, ''), '\D', '', 'g') LIKE '%' || v_digits_like || '%' ESCAPE '\'
             OR regexp_replace(COALESCE(cp.sus_number, ''), '\D', '', 'g') LIKE '%' || v_digits_like || '%' ESCAPE '\'
         ))
         OR public.normalize_paciente_search_text(cp.name) LIKE '%' || v_like || '%' ESCAPE '\'
         OR public.normalize_paciente_search_text(cp.nickname) LIKE '%' || v_like || '%' ESCAPE '\'
         OR (
             array_length(v_tokens, 1) > 1
             AND NOT EXISTS (
                 SELECT 1
                   FROM unnest(v_tokens) AS tk
                  WHERE length(tk) >= 1
                    AND (public.normalize_paciente_search_text(cp.name) || ' ' || public.normalize_paciente_search_text(cp.nickname))
                        NOT LIKE '%' || replace(replace(replace(tk, '\', '\\'), '%', '\%'), '_', '\_') || '%' ESCAPE '\'
             )
         )
     )
     ORDER BY
         CASE
             WHEN public.normalize_paciente_search_text(cp.name) = v_norm THEN 1
             WHEN public.normalize_paciente_search_text(cp.nickname) = v_norm THEN 2
             WHEN public.normalize_paciente_search_text(cp.name) LIKE v_like || '%' ESCAPE '\' THEN 3
             WHEN public.normalize_paciente_search_text(cp.nickname) LIKE v_like || '%' ESCAPE '\' THEN 4
             ELSE 5
         END,
         cp.name ASC
     LIMIT v_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.buscar_pacientes_autosenha(text, int) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.buscar_pacientes_autosenha(text, int) TO authenticated, service_role;

