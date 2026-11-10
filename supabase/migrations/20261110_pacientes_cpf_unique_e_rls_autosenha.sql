-- ============================================================================
-- MIGRATION: INTEGRIDADE DE CPF, BLOQUEIO DE DUPLICIDADE E RLS AUTOSENHA EM PACIENTES
-- Data: 2026-11-10
-- Rotas relacionadas:
--   /AutoSenha/PSF1/Controle, /AutoSenha/PSF2, /AutoSenha/PSF2/Controle, /AutoSenha/UPA/Controle
-- Objetivo:
--   1. Garantir normalização do CPF (apenas 11 dígitos), validação matemática dos dígitos
--      verificadores e bloqueio de cadastros duplicados em public.consultas_pacientes.
--   2. Garantir políticas RLS granulares para leitura e cadastro de pacientes pelos
--      operadores autorizados do AutoSenha (PSF1, PSF2, UPA, Pacientes, Dashboard),
--      mantendo bloqueados painéis públicos SenhaTV-only, usuários sem permissão e anon.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. FUNÇÃO E TRIGGER DE INTEGRIDADE DE CPF EM public.consultas_pacientes
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_consultas_pacientes_cpf_integrity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
    v_clean text;
    v_old_clean text;
    v_sum int;
    v_rem int;
    i int;
    v_dup_exists boolean;
BEGIN
    v_clean := regexp_replace(COALESCE(NEW.cpf, ''), '\D', '', 'g');
    v_old_clean := CASE WHEN TG_OP = 'UPDATE' THEN regexp_replace(COALESCE(OLD.cpf, ''), '\D', '', 'g') ELSE NULL END;

    -- Só valida rigorosamente em novos cadastros (INSERT) ou quando o CPF for alterado
    IF TG_OP = 'INSERT' OR v_clean IS DISTINCT FROM v_old_clean THEN
        IF length(v_clean) <> 11 OR v_clean ~ '^(\d)\1{10}$' THEN
            RAISE EXCEPTION 'CPF inválido: informe exatamente 11 dígitos verificadores válidos.'
                USING ERRCODE = '22023';
        END IF;

        -- 1º dígito verificador
        v_sum := 0;
        FOR i IN 1..9 LOOP
            v_sum := v_sum + (substr(v_clean, i, 1)::int * (11 - i));
        END LOOP;
        v_rem := (v_sum * 10) % 11;
        IF v_rem >= 10 THEN v_rem := 0; END IF;
        IF v_rem <> substr(v_clean, 10, 1)::int THEN
            RAISE EXCEPTION 'CPF inválido: dígito verificador incorreto.'
                USING ERRCODE = '22023';
        END IF;

        -- 2º dígito verificador
        v_sum := 0;
        FOR i IN 1..10 LOOP
            v_sum := v_sum + (substr(v_clean, i, 1)::int * (12 - i));
        END LOOP;
        v_rem := (v_sum * 10) % 11;
        IF v_rem >= 10 THEN v_rem := 0; END IF;
        IF v_rem <> substr(v_clean, 11, 1)::int THEN
            RAISE EXCEPTION 'CPF inválido: dígito verificador incorreto.'
                USING ERRCODE = '22023';
        END IF;

        -- Bloqueia qualquer duplicidade normalizada (com ou sem máscara)
        SELECT EXISTS (
            SELECT 1
              FROM public.consultas_pacientes cp
             WHERE regexp_replace(COALESCE(cp.cpf, ''), '\D', '', 'g') = v_clean
               AND cp.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
        ) INTO v_dup_exists;

        IF v_dup_exists THEN
            RAISE EXCEPTION 'Já existe um paciente cadastrado com o CPF informado na base integrada.'
                USING ERRCODE = '23505';
        END IF;

        -- Armazena sempre o CPF normalizado sem pontuação
        NEW.cpf := v_clean;
    END IF;

    RETURN NEW;
END;
$$;

DO $$
BEGIN
    IF to_regclass('public.consultas_pacientes') IS NOT NULL THEN
        DROP TRIGGER IF EXISTS trg_enforce_consultas_pacientes_cpf_integrity ON public.consultas_pacientes;
        CREATE TRIGGER trg_enforce_consultas_pacientes_cpf_integrity
            BEFORE INSERT OR UPDATE ON public.consultas_pacientes
            FOR EACH ROW
            EXECUTE FUNCTION public.enforce_consultas_pacientes_cpf_integrity();

        -- Tenta criar índice único por CPF normalizado (sem abortar se houver registros legados duplicados)
        BEGIN
            CREATE UNIQUE INDEX IF NOT EXISTS idx_consultas_pacientes_cpf_norm_unique
                ON public.consultas_pacientes ((regexp_replace(COALESCE(cpf, ''), '\D', '', 'g')))
                WHERE length(regexp_replace(COALESCE(cpf, ''), '\D', '', 'g')) = 11;
        EXCEPTION WHEN unique_violation THEN
            RAISE NOTICE 'Índice único normalizado não criado automaticamente por haver CPFs legados duplicados; trigger ativa para bloquear novas duplicidades.';
        END;
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2. AUTORIZAÇÃO RLS DE LEITURA E ESCRITA EM public.consultas_pacientes (AUTOSENHA + SAÚDE)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_access_autosenha_pacientes()
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

    -- Perfis operacionais do AutoSenha (Recepção/Controle PSF1, PSF2, UPA, Central de Pacientes, Dashboard)
    -- Painéis públicos SenhaTV-only não recebem acesso a dados pessoais de pacientes.
    IF v_perms && ARRAY[
        'sub_autosenha_pacientes',
        'sub_autosenha_psf1_controle', 'parent_autosenha_psf1_controle',
        'sub_autosenha_psf2_controle', 'parent_autosenha_psf2_controle',
        'sub_autosenha_upa_controle', 'parent_autosenha_upa_controle',
        'sub_autosenha_dashboard', 'parent_autosenha_dashboard'
    ] THEN
        RETURN true;
    END IF;

    -- Retrocompatibilidade estrita: legado apenas com parent_autosenha / autosenha (sem subchaves granulares)
    IF (v_perms && ARRAY['parent_autosenha', 'autosenha']) AND NOT (v_perms && v_all_autosenha_granular) THEN
        RETURN true;
    END IF;

    RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_read_consultas_pacientes_integrados()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
    IF public.can_access_autosenha_pacientes() THEN
        RETURN true;
    END IF;

    IF to_regprocedure('public.can_read_regulacao_agendamentos()') IS NOT NULL THEN
        RETURN public.can_read_regulacao_agendamentos();
    END IF;

    RETURN auth.role() IN ('authenticated', 'service_role');
END;
$$;

CREATE OR REPLACE FUNCTION public.can_write_consultas_pacientes()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_uid uuid;
    v_perms text[];
BEGIN
    IF public.can_access_autosenha_pacientes() THEN
        RETURN true;
    END IF;

    IF to_regprocedure('public.can_write_regulacao_agendamentos()') IS NOT NULL THEN
        IF public.can_write_regulacao_agendamentos() THEN
            RETURN true;
        END IF;
    END IF;

    v_uid := auth.uid();
    IF v_uid IS NULL THEN
        RETURN false;
    END IF;

    SELECT COALESCE(p.permissions, ARRAY[]::text[])
      INTO v_perms
      FROM public.profiles p
     WHERE p.id = v_uid;

    IF v_perms IS NULL THEN
        RETURN false;
    END IF;

    IF v_perms && ARRAY['sub_consultas_pacientes', 'parent_consultas_pacientes', 'sub_regulacao_pacientes'] THEN
        RETURN true;
    END IF;

    IF EXISTS (
        SELECT 1
          FROM unnest(v_perms) AS perm
         WHERE perm IN ('parent_farmacia')
            OR perm LIKE 'sub_farmacia_%'
            OR perm LIKE 'parent_farmacia_%'
    ) THEN
        RETURN true;
    END IF;

    RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.can_access_autosenha_pacientes() FROM anon, public;
REVOKE ALL ON FUNCTION public.can_read_consultas_pacientes_integrados() FROM anon, public;
REVOKE ALL ON FUNCTION public.can_write_consultas_pacientes() FROM anon, public;

GRANT EXECUTE ON FUNCTION public.can_access_autosenha_pacientes() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_read_consultas_pacientes_integrados() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_write_consultas_pacientes() TO authenticated, service_role;

DO $$
BEGIN
    IF to_regclass('public.consultas_pacientes') IS NOT NULL THEN
        ALTER TABLE public.consultas_pacientes ENABLE ROW LEVEL SECURITY;
        REVOKE ALL ON public.consultas_pacientes FROM anon;

        DROP POLICY IF EXISTS "Allow read access to authenticated users on consultas_pacientes" ON public.consultas_pacientes;
        DROP POLICY IF EXISTS "Allow write access to authenticated users on consultas_pacientes" ON public.consultas_pacientes;
        DROP POLICY IF EXISTS "consultas_pacientes_select_authorized" ON public.consultas_pacientes;
        DROP POLICY IF EXISTS "consultas_pacientes_insert_authorized" ON public.consultas_pacientes;
        DROP POLICY IF EXISTS "consultas_pacientes_update_authorized" ON public.consultas_pacientes;
        DROP POLICY IF EXISTS "consultas_pacientes_delete_authorized" ON public.consultas_pacientes;

        CREATE POLICY "consultas_pacientes_select_authorized"
        ON public.consultas_pacientes
        FOR SELECT
        TO authenticated
        USING (public.can_read_consultas_pacientes_integrados());

        CREATE POLICY "consultas_pacientes_insert_authorized"
        ON public.consultas_pacientes
        FOR INSERT
        TO authenticated
        WITH CHECK (public.can_write_consultas_pacientes());

        CREATE POLICY "consultas_pacientes_update_authorized"
        ON public.consultas_pacientes
        FOR UPDATE
        TO authenticated
        USING (public.can_write_consultas_pacientes())
        WITH CHECK (public.can_write_consultas_pacientes());

        CREATE POLICY "consultas_pacientes_delete_authorized"
        ON public.consultas_pacientes
        FOR DELETE
        TO authenticated
        USING (public.can_write_consultas_pacientes());
    END IF;
END $$;

NOTIFY pgrst, 'reload schema';

/* ============================================================================
   SCRIPT DE REVERSÃO (ROLLBACK) — SOMENTE SE NECESSÁRIO
   ============================================================================
   DROP TRIGGER IF EXISTS trg_enforce_consultas_pacientes_cpf_integrity ON public.consultas_pacientes;
   DROP FUNCTION IF EXISTS public.enforce_consultas_pacientes_cpf_integrity();
   DROP INDEX IF EXISTS public.idx_consultas_pacientes_cpf_norm_unique;
============================================================================ */

