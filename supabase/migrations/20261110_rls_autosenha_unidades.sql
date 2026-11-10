-- ============================================================================
-- MIGRATION: RLS POR UNIDADE E ÍNDICES DE PERFORMANCE DO AUTOSENHA
-- Data: 2026-11-10
-- Rotas relacionadas:
--   /AutoSenha/PSF1/Controle, /AutoSenha/PSF2, /AutoSenha/PSF2/Controle, /AutoSenha/UPA/Controle
-- Objetivo:
--   1. Substituir políticas permissivas (USING (true)) das tabelas do AutoSenha
--      por políticas RLS granulares isoladas por unidade (psf1, psf2, upa).
--   2. Garantir que usuários de uma unidade só consultem e operem filas e
--      históricos da(s) unidade(s) para as quais possuem permissão, bloqueando anon.
--   3. Criar índice composto para acelerar consultas paginadas do Histórico da Fila.
-- ============================================================================

-- 1. FUNÇÕES AUXILIARES SECURITY DEFINER (ISOLAMENTO POR UNIDADE)
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

    -- Retrocompatibilidade estrita para legado apenas com chave pai sem subchaves granulares
    IF (v_perms && ARRAY['parent_autosenha', 'autosenha']) AND NOT (v_perms && v_all_autosenha_granular) THEN
        RETURN true;
    END IF;

    RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_write_autosenha_unit(p_unidade_id text)
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
    v_unit_write_keys text[];
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
        v_unit_write_keys := ARRAY['sub_autosenha_psf1_controle', 'parent_autosenha_psf1_controle'];
    ELSIF p_unidade_id = 'psf2' THEN
        v_unit_write_keys := ARRAY['sub_autosenha_psf2_controle', 'parent_autosenha_psf2_controle'];
    ELSIF p_unidade_id = 'upa' THEN
        v_unit_write_keys := ARRAY['sub_autosenha_upa_controle', 'parent_autosenha_upa_controle'];
    ELSE
        RETURN false;
    END IF;

    IF v_perms && v_unit_write_keys THEN
        RETURN true;
    END IF;

    IF (v_perms && ARRAY['parent_autosenha', 'autosenha']) AND NOT (v_perms && v_all_autosenha_granular) THEN
        RETURN true;
    END IF;

    RETURN false;
END;
$$;

-- 2. ÍNDICE COMPOSTO PARA CONSULTAS DE HISTÓRICO DA FILA POR UNIDADE E DATA
DO $$
BEGIN
    IF to_regclass('public.autosenha_senhas') IS NOT NULL THEN
        CREATE INDEX IF NOT EXISTS idx_autosenha_senhas_unidade_hist
            ON public.autosenha_senhas (unidade_id, data_operacional DESC, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_autosenha_senhas_unidade_status
            ON public.autosenha_senhas (unidade_id, status, created_at DESC);
    END IF;
END $$;

-- 3. APLICAÇÃO DE RLS GRANULAR NAS TABELAS DO AUTOSENHA
DO $$
BEGIN
    -- autosenha_unidades
    IF to_regclass('public.autosenha_unidades') IS NOT NULL THEN
        ALTER TABLE public.autosenha_unidades ENABLE ROW LEVEL SECURITY;
        REVOKE ALL ON public.autosenha_unidades FROM anon;
        DROP POLICY IF EXISTS "Leitura pública e autenticada de unidades" ON public.autosenha_unidades;
        DROP POLICY IF EXISTS "autosenha_unidades_select_authenticated" ON public.autosenha_unidades;
        CREATE POLICY "autosenha_unidades_select_authenticated"
            ON public.autosenha_unidades FOR SELECT
            TO authenticated
            USING (public.can_read_autosenha_unit(id));
    END IF;

    -- autosenha_configuracoes
    IF to_regclass('public.autosenha_configuracoes') IS NOT NULL THEN
        ALTER TABLE public.autosenha_configuracoes ENABLE ROW LEVEL SECURITY;
        REVOKE ALL ON public.autosenha_configuracoes FROM anon;
        DROP POLICY IF EXISTS "Leitura pública e autenticada de configuracoes" ON public.autosenha_configuracoes;
        DROP POLICY IF EXISTS "Operações autenticadas em configuracoes" ON public.autosenha_configuracoes;
        DROP POLICY IF EXISTS "autosenha_config_select_unit" ON public.autosenha_configuracoes;
        DROP POLICY IF EXISTS "autosenha_config_write_unit" ON public.autosenha_configuracoes;
        CREATE POLICY "autosenha_config_select_unit"
            ON public.autosenha_configuracoes FOR SELECT
            TO authenticated
            USING (public.can_read_autosenha_unit(unidade_id));
        CREATE POLICY "autosenha_config_write_unit"
            ON public.autosenha_configuracoes FOR ALL
            TO authenticated
            USING (public.can_write_autosenha_unit(unidade_id))
            WITH CHECK (public.can_write_autosenha_unit(unidade_id));
    END IF;

    -- autosenha_senhas
    IF to_regclass('public.autosenha_senhas') IS NOT NULL THEN
        ALTER TABLE public.autosenha_senhas ENABLE ROW LEVEL SECURITY;
        REVOKE ALL ON public.autosenha_senhas FROM anon;
        DROP POLICY IF EXISTS "Leitura pública e autenticada de senhas" ON public.autosenha_senhas;
        DROP POLICY IF EXISTS "Operações autenticadas em senhas" ON public.autosenha_senhas;
        DROP POLICY IF EXISTS "autosenha_senhas_select_unit" ON public.autosenha_senhas;
        DROP POLICY IF EXISTS "autosenha_senhas_write_unit" ON public.autosenha_senhas;
        CREATE POLICY "autosenha_senhas_select_unit"
            ON public.autosenha_senhas FOR SELECT
            TO authenticated
            USING (public.can_read_autosenha_unit(unidade_id));
        CREATE POLICY "autosenha_senhas_write_unit"
            ON public.autosenha_senhas FOR ALL
            TO authenticated
            USING (public.can_write_autosenha_unit(unidade_id))
            WITH CHECK (public.can_write_autosenha_unit(unidade_id));
    END IF;

    -- autosenha_chamadas
    IF to_regclass('public.autosenha_chamadas') IS NOT NULL THEN
        ALTER TABLE public.autosenha_chamadas ENABLE ROW LEVEL SECURITY;
        REVOKE ALL ON public.autosenha_chamadas FROM anon;
        DROP POLICY IF EXISTS "Leitura pública e autenticada de chamadas" ON public.autosenha_chamadas;
        DROP POLICY IF EXISTS "Operações autenticadas em chamadas" ON public.autosenha_chamadas;
        DROP POLICY IF EXISTS "autosenha_chamadas_select_unit" ON public.autosenha_chamadas;
        DROP POLICY IF EXISTS "autosenha_chamadas_write_unit" ON public.autosenha_chamadas;
        CREATE POLICY "autosenha_chamadas_select_unit"
            ON public.autosenha_chamadas FOR SELECT
            TO authenticated
            USING (public.can_read_autosenha_unit(unidade_id));
        CREATE POLICY "autosenha_chamadas_write_unit"
            ON public.autosenha_chamadas FOR ALL
            TO authenticated
            USING (public.can_write_autosenha_unit(unidade_id))
            WITH CHECK (public.can_write_autosenha_unit(unidade_id));
    END IF;

    -- autosenha_auditoria
    IF to_regclass('public.autosenha_auditoria') IS NOT NULL THEN
        ALTER TABLE public.autosenha_auditoria ENABLE ROW LEVEL SECURITY;
        REVOKE ALL ON public.autosenha_auditoria FROM anon;
        DROP POLICY IF EXISTS "Leitura pública e autenticada de auditoria" ON public.autosenha_auditoria;
        DROP POLICY IF EXISTS "Operações autenticadas em auditoria" ON public.autosenha_auditoria;
        DROP POLICY IF EXISTS "autosenha_auditoria_select_unit" ON public.autosenha_auditoria;
        DROP POLICY IF EXISTS "autosenha_auditoria_insert_unit" ON public.autosenha_auditoria;
        CREATE POLICY "autosenha_auditoria_select_unit"
            ON public.autosenha_auditoria FOR SELECT
            TO authenticated
            USING (public.can_read_autosenha_unit(unidade_id));
        CREATE POLICY "autosenha_auditoria_insert_unit"
            ON public.autosenha_auditoria FOR INSERT
            TO authenticated
            WITH CHECK (public.can_write_autosenha_unit(unidade_id));
    END IF;

    -- autosenha_avaliacoes_urgentes
    IF to_regclass('public.autosenha_avaliacoes_urgentes') IS NOT NULL THEN
        ALTER TABLE public.autosenha_avaliacoes_urgentes ENABLE ROW LEVEL SECURITY;
        REVOKE ALL ON public.autosenha_avaliacoes_urgentes FROM anon;
        DROP POLICY IF EXISTS "Leitura pública e autenticada de avaliacoes" ON public.autosenha_avaliacoes_urgentes;
        DROP POLICY IF EXISTS "Operações autenticadas em avaliacoes" ON public.autosenha_avaliacoes_urgentes;
        DROP POLICY IF EXISTS "autosenha_urgentes_select_unit" ON public.autosenha_avaliacoes_urgentes;
        DROP POLICY IF EXISTS "autosenha_urgentes_write_unit" ON public.autosenha_avaliacoes_urgentes;
        CREATE POLICY "autosenha_urgentes_select_unit"
            ON public.autosenha_avaliacoes_urgentes FOR SELECT
            TO authenticated
            USING (public.can_read_autosenha_unit(unidade_id));
        CREATE POLICY "autosenha_urgentes_write_unit"
            ON public.autosenha_avaliacoes_urgentes FOR ALL
            TO authenticated
            USING (public.can_write_autosenha_unit(unidade_id))
            WITH CHECK (public.can_write_autosenha_unit(unidade_id));
    END IF;
END $$;

-- ROLLBACK (se necessário):
-- DROP POLICY IF EXISTS "autosenha_senhas_select_unit" ON public.autosenha_senhas;
-- DROP POLICY IF EXISTS "autosenha_senhas_write_unit" ON public.autosenha_senhas;
-- DROP FUNCTION IF EXISTS public.can_read_autosenha_unit(text);
-- DROP FUNCTION IF EXISTS public.can_write_autosenha_unit(text);
