-- Migration: Liberar leitura e cadastro integrado de pacientes (consultas_pacientes)
-- para usuários autorizados do módulo Agendamento de Veículos (/AgendamentoVeiculos).
-- Necessário para busca de passageiros na aba Tripulação e no Cadastro Rápido de Paciente.

CREATE OR REPLACE FUNCTION public.can_access_veiculos_pacientes()
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
                 WHERE gms.module_key IN ('parent_agendamento_veiculo', 'agendamento')
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

    IF EXISTS (
        SELECT 1
          FROM unnest(v_perms) AS perm
         WHERE perm IN ('parent_agendamento_veiculo', 'parent_agendamento_veiculos', 'agendamento')
            OR perm LIKE 'sub_agendamento_%'
            OR perm LIKE 'parent_agendamento_veiculo_%'
            OR perm LIKE 'sub_veiculos_%'
    ) THEN
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

    IF public.can_access_veiculos_pacientes() THEN
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

    IF public.can_access_veiculos_pacientes() THEN
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

REVOKE ALL ON FUNCTION public.can_access_veiculos_pacientes() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.can_access_veiculos_pacientes() TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
