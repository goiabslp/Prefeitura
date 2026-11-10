-- ============================================================================
-- MIGRATION: ADEQUAÇÃO À LGPD NOS PAINÉIS PÚBLICOS SENHATV (AUTOSENHA)
-- Data: 2026-11-10
-- Rotas relacionadas:
--   /AutoSenha/PSF1/SenhaTV, /AutoSenha/PSF2/SenhaTV, /AutoSenha/UPA/SenhaTV
-- Objetivo:
--   1. Criar can_read_autosenha_tv(p_unidade_id) para permitir leitura da TV
--      apenas para usuários autenticados com permissão da unidade.
--   2. Restringir can_read_autosenha_unit(p_unidade_id) às interfaces internas
--      autorizadas (Controle/Dashboard), impedindo que contas exclusivas de TV
--      consultem dados pessoais (nome, CPF, CNS) via REST em autosenha_senhas.
--   3. Criar RPC get_painel_senhatv_publico(p_unidade_id, p_data_operacional)
--      retornando EXCLUSIVAMENTE senha, guichê e metadados de fila sem PII.
-- ============================================================================

-- 1. PERMISSÃO PARA PAINEL SENHATV POR UNIDADE
CREATE OR REPLACE FUNCTION public.can_read_autosenha_tv(p_unidade_id text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_uid uuid;
    v_perms text[];
    v_global_disabled boolean := false;
    v_all_autosenha_granular text[] := ARRAY[
        'sub_autosenha_dashboard', 'parent_autosenha_dashboard',
        'sub_autosenha_pacientes',
        'sub_autosenha_psf1_controle', 'parent_autosenha_psf1_controle',
        'sub_autosenha_psf1_senhatv', 'parent_autosenha_psf1_senhatv',
        'sub_autosenha_psf2_controle', 'parent_autosenha_psf2_controle',
        'sub_autosenha_psf2_senhatv', 'parent_autosenha_psf2_senhatv',
        'sub_autosenha_upa_controle', 'parent_autosenha_upa_controle',
        'sub_autosenha_upa_senhatv', 'parent_autosenha_upa_senhatv'
    ];
    v_unit_keys text[];
BEGIN
    IF auth.role() = 'service_role' THEN
        RETURN true;
    END IF;

    v_uid := auth.uid();
    IF v_uid IS NULL THEN
        RETURN false;
    END IF;

    IF to_regclass('public.global_module_settings') IS NOT NULL THEN
        BEGIN
            SELECT EXISTS (
                SELECT 1
                  FROM public.global_module_settings gms
                 WHERE gms.module_key IN ('parent_autosenha', 'autosenha')
                   AND COALESCE(gms.is_enabled, true) = false
                   AND COALESCE(gms.is_enabled_mobile, true) = false
            ) INTO v_global_disabled;
        EXCEPTION WHEN OTHERS THEN
            v_global_disabled := false;
        END;

        IF v_global_disabled THEN
            RETURN false;
        END IF;
    END IF;

    SELECT COALESCE(p.permissions, ARRAY[]::text[])
      INTO v_perms
      FROM public.profiles p
     WHERE p.id = v_uid;

    IF v_perms IS NULL THEN
        RETURN false;
    END IF;

    IF v_perms && ARRAY['sub_autosenha_dashboard', 'parent_autosenha_dashboard'] THEN
        RETURN true;
    END IF;

    IF p_unidade_id = 'psf1' THEN
        v_unit_keys := ARRAY[
            'sub_autosenha_psf1_controle', 'parent_autosenha_psf1_controle',
            'sub_autosenha_psf1_senhatv', 'parent_autosenha_psf1_senhatv'
        ];
    ELSIF p_unidade_id = 'psf2' THEN
        v_unit_keys := ARRAY[
            'sub_autosenha_psf2_controle', 'parent_autosenha_psf2_controle',
            'sub_autosenha_psf2_senhatv', 'parent_autosenha_psf2_senhatv'
        ];
    ELSIF p_unidade_id = 'upa' THEN
        v_unit_keys := ARRAY[
            'sub_autosenha_upa_controle', 'parent_autosenha_upa_controle',
            'sub_autosenha_upa_senhatv', 'parent_autosenha_upa_senhatv'
        ];
    ELSE
        RETURN false;
    END IF;

    IF v_perms && v_unit_keys THEN
        RETURN true;
    END IF;

    IF (v_perms && ARRAY['parent_autosenha', 'autosenha']) AND NOT (v_perms && v_all_autosenha_granular) THEN
        RETURN true;
    END IF;

    RETURN false;
END;
$$;

-- 2. RESTRINGIR LEITURA INTEGRAL (COM DADOS PESSOAIS) APENAS ÀS TELAS INTERNAS
-- Contas exclusivas de SenhaTV passam a ler SOMENTE pela RPC anonimizada.
CREATE OR REPLACE FUNCTION public.can_read_autosenha_unit(p_unidade_id text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_uid uuid;
    v_perms text[];
    v_global_disabled boolean := false;
    v_all_autosenha_granular text[] := ARRAY[
        'sub_autosenha_dashboard', 'parent_autosenha_dashboard',
        'sub_autosenha_pacientes',
        'sub_autosenha_psf1_controle', 'parent_autosenha_psf1_controle',
        'sub_autosenha_psf1_senhatv', 'parent_autosenha_psf1_senhatv',
        'sub_autosenha_psf2_controle', 'parent_autosenha_psf2_controle',
        'sub_autosenha_psf2_senhatv', 'parent_autosenha_psf2_senhatv',
        'sub_autosenha_upa_controle', 'parent_autosenha_upa_controle',
        'sub_autosenha_upa_senhatv', 'parent_autosenha_upa_senhatv'
    ];
    v_unit_internal_keys text[];
BEGIN
    IF auth.role() = 'service_role' THEN
        RETURN true;
    END IF;

    v_uid := auth.uid();
    IF v_uid IS NULL THEN
        RETURN false;
    END IF;

    IF to_regclass('public.global_module_settings') IS NOT NULL THEN
        BEGIN
            SELECT EXISTS (
                SELECT 1
                  FROM public.global_module_settings gms
                 WHERE gms.module_key IN ('parent_autosenha', 'autosenha')
                   AND COALESCE(gms.is_enabled, true) = false
                   AND COALESCE(gms.is_enabled_mobile, true) = false
            ) INTO v_global_disabled;
        EXCEPTION WHEN OTHERS THEN
            v_global_disabled := false;
        END;

        IF v_global_disabled THEN
            RETURN false;
        END IF;
    END IF;

    SELECT COALESCE(p.permissions, ARRAY[]::text[])
      INTO v_perms
      FROM public.profiles p
     WHERE p.id = v_uid;

    IF v_perms IS NULL THEN
        RETURN false;
    END IF;

    IF v_perms && ARRAY['sub_autosenha_dashboard', 'parent_autosenha_dashboard'] THEN
        RETURN true;
    END IF;

    IF p_unidade_id = 'psf1' THEN
        v_unit_internal_keys := ARRAY['sub_autosenha_psf1_controle', 'parent_autosenha_psf1_controle'];
    ELSIF p_unidade_id = 'psf2' THEN
        v_unit_internal_keys := ARRAY['sub_autosenha_psf2_controle', 'parent_autosenha_psf2_controle'];
    ELSIF p_unidade_id = 'upa' THEN
        v_unit_internal_keys := ARRAY['sub_autosenha_upa_controle', 'parent_autosenha_upa_controle'];
    ELSE
        RETURN false;
    END IF;

    IF v_perms && v_unit_internal_keys THEN
        RETURN true;
    END IF;

    IF (v_perms && ARRAY['parent_autosenha', 'autosenha']) AND NOT (v_perms && v_all_autosenha_granular) THEN
        RETURN true;
    END IF;

    RETURN false;
END;
$$;

-- 3. ATUALIZAR POLICIES DE CONFIGURAÇÃO E UNIDADES (SEM PII) PARA PERMISSÃO DE TV
DO $$
BEGIN
    IF to_regclass('public.autosenha_unidades') IS NOT NULL THEN
        DROP POLICY IF EXISTS "autosenha_unidades_select_authenticated" ON public.autosenha_unidades;
        CREATE POLICY "autosenha_unidades_select_authenticated"
            ON public.autosenha_unidades FOR SELECT
            TO authenticated
            USING (public.can_read_autosenha_tv(id));
    END IF;

    IF to_regclass('public.autosenha_configuracoes') IS NOT NULL THEN
        DROP POLICY IF EXISTS "autosenha_config_select_unit" ON public.autosenha_configuracoes;
        CREATE POLICY "autosenha_config_select_unit"
            ON public.autosenha_configuracoes FOR SELECT
            TO authenticated
            USING (public.can_read_autosenha_tv(unidade_id));
    END IF;
END $$;

-- 4. RPC PÚBLICA ANONIMIZADA DA SENHATV (SOMENTE NÚMERO DA SENHA E GUICHÊ)
DROP FUNCTION IF EXISTS public.get_painel_senhatv_publico(text, date);

CREATE OR REPLACE FUNCTION public.get_painel_senhatv_publico(
    p_unidade_id text,
    p_data_operacional date DEFAULT NULL
)
RETURNS TABLE (
    id uuid,
    unidade_id text,
    numero text,
    guiche text,
    status text,
    bloco_numero int,
    posicao_bloco int,
    first_called_at timestamptz,
    last_called_at timestamptz,
    call_count int,
    created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_data date := COALESCE(p_data_operacional, (timezone('America/Sao_Paulo', now())::date));
BEGIN
    IF auth.role() <> 'service_role' THEN
        IF auth.uid() IS NULL OR NOT public.can_read_autosenha_tv(p_unidade_id) THEN
            RAISE EXCEPTION 'Acesso negado ao painel SenhaTV desta unidade.'
                USING ERRCODE = '42501';
        END IF;
    END IF;

    RETURN QUERY
    SELECT
        s.id::uuid,
        s.unidade_id::text,
        s.numero::text,
        COALESCE(NULLIF(trim(s.guiche::text), ''), 'Recepção')::text AS guiche,
        s.status::text,
        s.bloco_numero::int,
        s.posicao_bloco::int,
        s.first_called_at::timestamptz,
        s.last_called_at::timestamptz,
        COALESCE(s.call_count, 0)::int AS call_count,
        s.created_at::timestamptz
      FROM public.autosenha_senhas s
     WHERE s.unidade_id = p_unidade_id
       AND s.data_operacional = v_data
     ORDER BY
        s.bloco_numero ASC NULLS LAST,
        s.posicao_bloco ASC NULLS LAST,
        s.created_at ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.can_read_autosenha_tv(text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.can_read_autosenha_tv(text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_painel_senhatv_publico(text, date) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_painel_senhatv_publico(text, date) TO authenticated, service_role;
