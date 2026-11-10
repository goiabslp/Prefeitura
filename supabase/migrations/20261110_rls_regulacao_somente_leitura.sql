-- ============================================================================
-- MIGRATION: CONTROLE DE ACESSO GRANULAR E BLINDAGEM RLS - REGULAÇÃO SOMENTE LEITURA
-- Data: 2026-11-10
-- Rotas relacionadas: /Admin/ControleAcesso, /Regulacao/Acompanhar
-- Objetivo:
--   1. Garantir leitura autenticada para usuários com a permissão
--      "sub_consultas_acompanhar_leitura" (Acompanhar Solicitações — Somente Leitura).
--   2. Bloquear no banco (RLS + RPC) qualquer INSERT, UPDATE ou DELETE em tabelas
--      da Regulação quando executados por usuários somente leitura ou sem permissão,
--      mesmo em chamadas diretas REST/RPC fora da UI.
--   3. Preservar retrocompatibilidade com Administradores, Gestores da Regulação,
--      usuários operacionais da Regulação, usuários legados apenas com chave pai,
--      Farmácia Popular e AutoSenha.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. FUNÇÕES AUXILIARES DE AUTORIZAÇÃO (SECURITY DEFINER)
-- ----------------------------------------------------------------------------

-- Verifica se o usuário autenticado é Administrador ou Gestor da Regulação
CREATE OR REPLACE FUNCTION public.is_regulacao_gestor_or_admin()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_uid uuid;
    v_role text;
    v_perms text[];
    v_is_ui_gestor boolean := false;
    v_is_table_gestor boolean := false;
BEGIN
    IF auth.role() = 'service_role' THEN
        RETURN true;
    END IF;

    v_uid := auth.uid();
    IF v_uid IS NULL THEN
        RETURN false;
    END IF;

    SELECT p.role, COALESCE(p.permissions, ARRAY[]::text[])
      INTO v_role, v_perms
      FROM public.profiles p
     WHERE p.id = v_uid;

    IF v_role = 'admin' THEN
        RETURN true;
    END IF;

    IF v_perms && ARRAY['sub_consultas_gestor', 'parent_consultas_gestor', 'sub_regulacao_gestor'] THEN
        RETURN true;
    END IF;

    -- Verifica gestores configurados em organization_settings.ui_config->consultas_gestores
    BEGIN
        SELECT EXISTS (
            SELECT 1
              FROM public.organization_settings os,
                   jsonb_array_elements_text(COALESCE(os.ui_config->'consultas_gestores', '[]'::jsonb)) AS g(uid_text)
             WHERE os.id = 'global_config'
               AND g.uid_text = v_uid::text
        ) INTO v_is_ui_gestor;
    EXCEPTION WHEN OTHERS THEN
        v_is_ui_gestor := false;
    END;

    IF v_is_ui_gestor THEN
        RETURN true;
    END IF;

    -- Verifica tabela consultas_gestores se existir no projeto
    BEGIN
        EXECUTE 'SELECT EXISTS (SELECT 1 FROM public.consultas_gestores WHERE gestor_id = $1)'
           INTO v_is_table_gestor
          USING v_uid;
    EXCEPTION WHEN undefined_table OR OTHERS THEN
        v_is_table_gestor := false;
    END;

    RETURN COALESCE(v_is_table_gestor, false);
END;
$$;

-- Verifica se o usuário possui acesso de LEITURA em agendamentos da Regulação
-- (inclui Somente Leitura, operacionais, gestores, admins, Farmácia Popular e AutoSenha)
CREATE OR REPLACE FUNCTION public.can_read_regulacao_agendamentos()
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
    IF public.is_regulacao_gestor_or_admin() THEN
        RETURN true;
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

    -- Regulação (Somente Leitura, Operacional, Novo Agendamento, Dados, Pacientes ou legado pai)
    IF v_perms && ARRAY[
        'sub_consultas_acompanhar_leitura',
        'sub_regulacao_acompanhar_leitura',
        'parent_consultas_acompanhar_leitura',
        'sub_consultas_acompanhar',
        'parent_consultas_acompanhar',
        'sub_regulacao_acompanhar',
        'sub_consultas_novo_agendamento',
        'parent_consultas_novo_agendamento',
        'sub_regulacao_novo_agendamento',
        'sub_consultas_dados',
        'parent_consultas_dados',
        'sub_regulacao_dados',
        'sub_consultas_pacientes',
        'parent_consultas_pacientes',
        'sub_regulacao_pacientes',
        'parent_consultas',
        'parent_regulacao'
    ] THEN
        RETURN true;
    END IF;

    -- Integrações legítimas cross-module (Farmácia Popular e AutoSenha consultam histórico/pacientes)
    IF EXISTS (
        SELECT 1
          FROM unnest(v_perms) AS perm
         WHERE perm IN ('parent_farmacia', 'parent_autosenha')
            OR perm LIKE 'sub_farmacia_%'
            OR perm LIKE 'parent_farmacia_%'
            OR perm LIKE 'sub_autosenha_%'
    ) THEN
        RETURN true;
    END IF;

    RETURN false;
END;
$$;

-- Verifica se o módulo Regulação e o submódulo especificado estão ativos globalmente (global_module_settings)
CREATE OR REPLACE FUNCTION public.is_regulacao_submodule_globally_enabled(
    p_sub_key text,
    p_legacy_keys text[] DEFAULT ARRAY[]::text[]
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_has_disabled boolean := false;
    v_parent_keys text[] := ARRAY['parent_consultas', 'consultas', 'regulacao', 'parent_regulacao'];
    v_sub_keys text[];
BEGIN
    IF auth.role() = 'service_role' THEN
        RETURN true;
    END IF;

    IF to_regclass('public.global_module_settings') IS NULL THEN
        RETURN true;
    END IF;

    v_sub_keys := ARRAY[p_sub_key] || COALESCE(p_legacy_keys, ARRAY[]::text[]);

    BEGIN
        SELECT EXISTS (
            SELECT 1
              FROM public.global_module_settings gms
             WHERE gms.module_key = ANY(v_parent_keys || v_sub_keys)
               AND COALESCE(gms.is_enabled, true) = false
        ) INTO v_has_disabled;
    EXCEPTION WHEN OTHERS THEN
        v_has_disabled := false;
    END;

    RETURN NOT COALESCE(v_has_disabled, false);
END;
$$;

-- Verifica estritamente se o usuário possui acesso OPERACIONAL (ESCRITA) na tela Acompanhar.
-- REGRA ESTRITA (sem bypass para Admin ou Gestor quando 'Acompanhar' estiver desativado):
-- 1. Módulo e submódulo 'sub_consultas_acompanhar' precisam estar ativos em global_module_settings.
-- 2. Usuário precisa possuir 'sub_consultas_acompanhar' (ou legadas) em profiles.permissions,
--    ou ser usuário legado apenas com chave pai sem nenhuma subchave granular.
-- Usuários com 'sub_consultas_acompanhar' desativado e 'sub_consultas_acompanhar_leitura' ativado recebem FALSE.
CREATE OR REPLACE FUNCTION public.can_write_regulacao_acompanhar()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_uid uuid;
    v_perms text[];
    v_all_granular text[] := ARRAY[
        'sub_consultas_novo_agendamento', 'parent_consultas_novo_agendamento', 'sub_regulacao_novo_agendamento',
        'sub_consultas_liberar_vagas', 'parent_consultas_liberar_vagas', 'sub_regulacao_liberar_vagas',
        'sub_consultas_acompanhar', 'parent_consultas_acompanhar', 'sub_regulacao_acompanhar',
        'sub_consultas_acompanhar_leitura', 'sub_regulacao_acompanhar_leitura', 'parent_consultas_acompanhar_leitura',
        'sub_consultas_definir_agenda', 'parent_consultas_definir_agenda', 'sub_regulacao_definir_agenda',
        'sub_consultas_procedimentos', 'parent_consultas_procedimentos', 'sub_regulacao_procedimentos',
        'sub_consultas_dados', 'parent_consultas_dados', 'sub_regulacao_dados',
        'sub_consultas_pacientes', 'parent_consultas_pacientes', 'sub_regulacao_pacientes',
        'sub_consultas_gestor', 'parent_consultas_gestor', 'sub_regulacao_gestor'
    ];
BEGIN
    IF auth.role() = 'service_role' THEN
        RETURN true;
    END IF;

    IF NOT public.is_regulacao_submodule_globally_enabled(
        'sub_consultas_acompanhar',
        ARRAY['parent_consultas_acompanhar', 'sub_regulacao_acompanhar']
    ) THEN
        RETURN false;
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

    -- Permissão operacional explícita em Acompanhar
    IF v_perms && ARRAY[
        'sub_consultas_acompanhar',
        'parent_consultas_acompanhar',
        'sub_regulacao_acompanhar'
    ] THEN
        RETURN true;
    END IF;

    -- Retrocompatibilidade estrita: usuário legado apenas com chave pai (sem chaves granulares)
    IF (v_perms && ARRAY['parent_consultas', 'parent_regulacao']) AND NOT (v_perms && v_all_granular) THEN
        RETURN true;
    END IF;

    RETURN false;
END;
$$;

-- Verifica se o usuário possui acesso para INSERIR agendamentos (via Acompanhar operacional ou Novo Agendamento).
-- Usuários com apenas 'sub_consultas_acompanhar_leitura' recebem FALSE.
CREATE OR REPLACE FUNCTION public.can_write_regulacao_agendamentos()
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
    IF public.can_write_regulacao_acompanhar() THEN
        RETURN true;
    END IF;

    IF NOT public.is_regulacao_submodule_globally_enabled(
        'sub_consultas_novo_agendamento',
        ARRAY['parent_consultas_novo_agendamento', 'sub_regulacao_novo_agendamento']
    ) THEN
        RETURN false;
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

    RETURN COALESCE(v_perms && ARRAY[
        'sub_consultas_novo_agendamento',
        'parent_consultas_novo_agendamento',
        'sub_regulacao_novo_agendamento'
    ], false);
END;
$$;

-- Verifica se o usuário pode inserir/editar pacientes compartilhados (Regulação, Farmácia Popular, AutoSenha)
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
    IF public.can_write_regulacao_agendamentos() THEN
        RETURN true;
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

    -- Farmácia Popular e AutoSenha utilizam consultas_pacientes como base unificada
    IF EXISTS (
        SELECT 1
          FROM unnest(v_perms) AS perm
         WHERE perm IN ('parent_farmacia', 'parent_autosenha')
            OR perm LIKE 'sub_farmacia_%'
            OR perm LIKE 'parent_farmacia_%'
            OR perm LIKE 'sub_autosenha_%'
    ) THEN
        RETURN true;
    END IF;

    RETURN false;
END;
$$;

-- Verifica permissão para gerenciar vagas da Regulação (Liberar Vagas ou fluxo operacional de Acompanhar)
CREATE OR REPLACE FUNCTION public.can_write_consultas_vagas()
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
    IF public.can_write_regulacao_agendamentos() THEN
        RETURN true;
    END IF;

    v_uid := auth.uid();
    IF v_uid IS NULL THEN
        RETURN false;
    END IF;

    SELECT COALESCE(p.permissions, ARRAY[]::text[])
      INTO v_perms
      FROM public.profiles p
     WHERE p.id = v_uid;

    RETURN COALESCE(v_perms && ARRAY[
        'sub_consultas_liberar_vagas',
        'parent_consultas_liberar_vagas',
        'sub_regulacao_liberar_vagas'
    ], false);
END;
$$;

-- Verifica permissão para editar catálogo de Procedimentos e Especialistas
CREATE OR REPLACE FUNCTION public.can_write_regulacao_catalogo()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_uid uuid;
    v_perms text[];
    v_all_granular text[] := ARRAY[
        'sub_consultas_novo_agendamento', 'parent_consultas_novo_agendamento', 'sub_regulacao_novo_agendamento',
        'sub_consultas_liberar_vagas', 'parent_consultas_liberar_vagas', 'sub_regulacao_liberar_vagas',
        'sub_consultas_acompanhar', 'parent_consultas_acompanhar', 'sub_regulacao_acompanhar',
        'sub_consultas_acompanhar_leitura', 'sub_regulacao_acompanhar_leitura', 'parent_consultas_acompanhar_leitura',
        'sub_consultas_definir_agenda', 'parent_consultas_definir_agenda', 'sub_regulacao_definir_agenda',
        'sub_consultas_procedimentos', 'parent_consultas_procedimentos', 'sub_regulacao_procedimentos',
        'sub_consultas_dados', 'parent_consultas_dados', 'sub_regulacao_dados',
        'sub_consultas_pacientes', 'parent_consultas_pacientes', 'sub_regulacao_pacientes',
        'sub_consultas_gestor', 'parent_consultas_gestor', 'sub_regulacao_gestor'
    ];
BEGIN
    IF public.is_regulacao_gestor_or_admin() THEN
        RETURN true;
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

    IF v_perms && ARRAY['sub_consultas_procedimentos', 'parent_consultas_procedimentos', 'sub_regulacao_procedimentos'] THEN
        RETURN true;
    END IF;

    IF (v_perms && ARRAY['parent_consultas', 'parent_regulacao']) AND NOT (v_perms && v_all_granular) THEN
        RETURN true;
    END IF;

    RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.is_regulacao_submodule_globally_enabled(text, text[]) FROM anon, public;
REVOKE ALL ON FUNCTION public.is_regulacao_gestor_or_admin() FROM anon, public;
REVOKE ALL ON FUNCTION public.can_read_regulacao_agendamentos() FROM anon, public;
REVOKE ALL ON FUNCTION public.can_write_regulacao_acompanhar() FROM anon, public;
REVOKE ALL ON FUNCTION public.can_write_regulacao_agendamentos() FROM anon, public;
REVOKE ALL ON FUNCTION public.can_write_consultas_pacientes() FROM anon, public;
REVOKE ALL ON FUNCTION public.can_write_consultas_vagas() FROM anon, public;
REVOKE ALL ON FUNCTION public.can_write_regulacao_catalogo() FROM anon, public;

GRANT EXECUTE ON FUNCTION public.is_regulacao_submodule_globally_enabled(text, text[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_regulacao_gestor_or_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_read_regulacao_agendamentos() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_write_regulacao_acompanhar() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_write_regulacao_agendamentos() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_write_consultas_pacientes() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_write_consultas_vagas() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_write_regulacao_catalogo() TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 2. POLÍTICAS RLS: public.consultas_agendamentos
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    IF to_regclass('public.consultas_agendamentos') IS NOT NULL THEN
        ALTER TABLE public.consultas_agendamentos ENABLE ROW LEVEL SECURITY;
        REVOKE ALL ON public.consultas_agendamentos FROM anon;

        DROP POLICY IF EXISTS "Allow read access to authenticated users on consultas_agendamentos" ON public.consultas_agendamentos;
        DROP POLICY IF EXISTS "Allow write access to authenticated users on consultas_agendamentos" ON public.consultas_agendamentos;
        DROP POLICY IF EXISTS "consultas_agendamentos_select_authorized" ON public.consultas_agendamentos;
        DROP POLICY IF EXISTS "consultas_agendamentos_insert_operational" ON public.consultas_agendamentos;
        DROP POLICY IF EXISTS "consultas_agendamentos_update_operational" ON public.consultas_agendamentos;
        DROP POLICY IF EXISTS "consultas_agendamentos_delete_gestor" ON public.consultas_agendamentos;

        CREATE POLICY "consultas_agendamentos_select_authorized"
        ON public.consultas_agendamentos
        FOR SELECT
        TO authenticated
        USING (public.can_read_regulacao_agendamentos());

        CREATE POLICY "consultas_agendamentos_insert_operational"
        ON public.consultas_agendamentos
        FOR INSERT
        TO authenticated
        WITH CHECK (public.can_write_regulacao_agendamentos());

        CREATE POLICY "consultas_agendamentos_update_operational"
        ON public.consultas_agendamentos
        FOR UPDATE
        TO authenticated
        USING (public.can_write_regulacao_acompanhar())
        WITH CHECK (public.can_write_regulacao_acompanhar());

        CREATE POLICY "consultas_agendamentos_delete_gestor"
        ON public.consultas_agendamentos
        FOR DELETE
        TO authenticated
        USING (public.is_regulacao_gestor_or_admin() AND public.can_write_regulacao_acompanhar());
    ELSE
        RAISE NOTICE 'Tabela public.consultas_agendamentos não encontrada; políticas ignoradas.';
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 3. POLÍTICAS RLS: public.consultas_solicitacoes_cancelamento
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    IF to_regclass('public.consultas_solicitacoes_cancelamento') IS NOT NULL THEN
        ALTER TABLE public.consultas_solicitacoes_cancelamento ENABLE ROW LEVEL SECURITY;
        REVOKE ALL ON public.consultas_solicitacoes_cancelamento FROM anon;

        DROP POLICY IF EXISTS "Todos autenticados podem consultar solicitações" ON public.consultas_solicitacoes_cancelamento;
        DROP POLICY IF EXISTS "Usuários autenticados podem inserir solicitações" ON public.consultas_solicitacoes_cancelamento;
        DROP POLICY IF EXISTS "Usuários autenticados podem atualizar solicitações" ON public.consultas_solicitacoes_cancelamento;
        DROP POLICY IF EXISTS "consultas_cancelamentos_select_authorized" ON public.consultas_solicitacoes_cancelamento;
        DROP POLICY IF EXISTS "consultas_cancelamentos_insert_operational" ON public.consultas_solicitacoes_cancelamento;
        DROP POLICY IF EXISTS "consultas_cancelamentos_update_gestor" ON public.consultas_solicitacoes_cancelamento;
        DROP POLICY IF EXISTS "consultas_cancelamentos_delete_gestor" ON public.consultas_solicitacoes_cancelamento;

        CREATE POLICY "consultas_cancelamentos_select_authorized"
        ON public.consultas_solicitacoes_cancelamento
        FOR SELECT
        TO authenticated
        USING (public.can_read_regulacao_agendamentos());

        CREATE POLICY "consultas_cancelamentos_insert_operational"
        ON public.consultas_solicitacoes_cancelamento
        FOR INSERT
        TO authenticated
        WITH CHECK (public.can_write_regulacao_acompanhar());

        CREATE POLICY "consultas_cancelamentos_update_gestor"
        ON public.consultas_solicitacoes_cancelamento
        FOR UPDATE
        TO authenticated
        USING (public.is_regulacao_gestor_or_admin() AND public.can_write_regulacao_acompanhar())
        WITH CHECK (public.is_regulacao_gestor_or_admin() AND public.can_write_regulacao_acompanhar());

        CREATE POLICY "consultas_cancelamentos_delete_gestor"
        ON public.consultas_solicitacoes_cancelamento
        FOR DELETE
        TO authenticated
        USING (public.is_regulacao_gestor_or_admin() AND public.can_write_regulacao_acompanhar());
    ELSE
        RAISE NOTICE 'Tabela public.consultas_solicitacoes_cancelamento ainda não existe; políticas ignoradas (aplique 20261029_create_consultas_solicitacoes_cancelamento.sql e re-execute esta migration se desejar persistência no banco).';
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 4. POLÍTICAS RLS: public.consultas_pacientes
-- ----------------------------------------------------------------------------
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
        USING (public.can_read_regulacao_agendamentos());

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
    ELSE
        RAISE NOTICE 'Tabela public.consultas_pacientes não encontrada; políticas ignoradas.';
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 5. POLÍTICAS RLS: public.consultas_vagas
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    IF to_regclass('public.consultas_vagas') IS NOT NULL THEN
        ALTER TABLE public.consultas_vagas ENABLE ROW LEVEL SECURITY;
        REVOKE ALL ON public.consultas_vagas FROM anon;

        DROP POLICY IF EXISTS "Allow read access to authenticated users on consultas_vagas" ON public.consultas_vagas;
        DROP POLICY IF EXISTS "Allow write access to authenticated users on consultas_vagas" ON public.consultas_vagas;
        DROP POLICY IF EXISTS "consultas_vagas_select_authenticated" ON public.consultas_vagas;
        DROP POLICY IF EXISTS "consultas_vagas_insert_authorized" ON public.consultas_vagas;
        DROP POLICY IF EXISTS "consultas_vagas_update_authorized" ON public.consultas_vagas;
        DROP POLICY IF EXISTS "consultas_vagas_delete_authorized" ON public.consultas_vagas;

        CREATE POLICY "consultas_vagas_select_authenticated"
        ON public.consultas_vagas
        FOR SELECT
        TO authenticated
        USING (true);

        CREATE POLICY "consultas_vagas_insert_authorized"
        ON public.consultas_vagas
        FOR INSERT
        TO authenticated
        WITH CHECK (public.can_write_consultas_vagas());

        CREATE POLICY "consultas_vagas_update_authorized"
        ON public.consultas_vagas
        FOR UPDATE
        TO authenticated
        USING (public.can_write_consultas_vagas())
        WITH CHECK (public.can_write_consultas_vagas());

        CREATE POLICY "consultas_vagas_delete_authorized"
        ON public.consultas_vagas
        FOR DELETE
        TO authenticated
        USING (public.can_write_consultas_vagas());
    ELSE
        RAISE NOTICE 'Tabela public.consultas_vagas não encontrada; políticas ignoradas.';
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 6. POLÍTICAS RLS: public.consultas_procedimentos e public.consultas_especialistas
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    IF to_regclass('public.consultas_procedimentos') IS NOT NULL THEN
        ALTER TABLE public.consultas_procedimentos ENABLE ROW LEVEL SECURITY;
        REVOKE ALL ON public.consultas_procedimentos FROM anon;

        DROP POLICY IF EXISTS "Allow read access to authenticated users on consultas_procedimentos" ON public.consultas_procedimentos;
        DROP POLICY IF EXISTS "Allow write access to authenticated users on consultas_procedimentos" ON public.consultas_procedimentos;
        DROP POLICY IF EXISTS "Enable all access for consultas_procedimentos" ON public.consultas_procedimentos;
        DROP POLICY IF EXISTS "Enable insert for all users" ON public.consultas_procedimentos;
        DROP POLICY IF EXISTS "consultas_procedimentos_select" ON public.consultas_procedimentos;
        DROP POLICY IF EXISTS "consultas_procedimentos_write" ON public.consultas_procedimentos;
        DROP POLICY IF EXISTS "consultas_procedimentos_insert_authorized" ON public.consultas_procedimentos;
        DROP POLICY IF EXISTS "consultas_procedimentos_update_authorized" ON public.consultas_procedimentos;
        DROP POLICY IF EXISTS "consultas_procedimentos_delete_authorized" ON public.consultas_procedimentos;

        CREATE POLICY "consultas_procedimentos_select"
        ON public.consultas_procedimentos
        FOR SELECT
        TO authenticated
        USING (true);

        CREATE POLICY "consultas_procedimentos_insert_authorized"
        ON public.consultas_procedimentos
        FOR INSERT
        TO authenticated
        WITH CHECK (public.can_write_regulacao_catalogo());

        CREATE POLICY "consultas_procedimentos_update_authorized"
        ON public.consultas_procedimentos
        FOR UPDATE
        TO authenticated
        USING (public.can_write_regulacao_catalogo())
        WITH CHECK (public.can_write_regulacao_catalogo());

        CREATE POLICY "consultas_procedimentos_delete_authorized"
        ON public.consultas_procedimentos
        FOR DELETE
        TO authenticated
        USING (public.can_write_regulacao_catalogo());
    ELSE
        RAISE NOTICE 'Tabela public.consultas_procedimentos não encontrada; políticas ignoradas.';
    END IF;
END $$;

DO $$
BEGIN
    IF to_regclass('public.consultas_especialistas') IS NOT NULL THEN
        ALTER TABLE public.consultas_especialistas ENABLE ROW LEVEL SECURITY;
        REVOKE ALL ON public.consultas_especialistas FROM anon;

        DROP POLICY IF EXISTS "Permitir acesso completo a consultas_especialistas" ON public.consultas_especialistas;
        DROP POLICY IF EXISTS "consultas_especialistas_select" ON public.consultas_especialistas;
        DROP POLICY IF EXISTS "consultas_especialistas_insert_authorized" ON public.consultas_especialistas;
        DROP POLICY IF EXISTS "consultas_especialistas_update_authorized" ON public.consultas_especialistas;
        DROP POLICY IF EXISTS "consultas_especialistas_delete_authorized" ON public.consultas_especialistas;

        CREATE POLICY "consultas_especialistas_select"
        ON public.consultas_especialistas
        FOR SELECT
        TO authenticated
        USING (true);

        CREATE POLICY "consultas_especialistas_insert_authorized"
        ON public.consultas_especialistas
        FOR INSERT
        TO authenticated
        WITH CHECK (public.can_write_regulacao_catalogo());

        CREATE POLICY "consultas_especialistas_update_authorized"
        ON public.consultas_especialistas
        FOR UPDATE
        TO authenticated
        USING (public.can_write_regulacao_catalogo())
        WITH CHECK (public.can_write_regulacao_catalogo());

        CREATE POLICY "consultas_especialistas_delete_authorized"
        ON public.consultas_especialistas
        FOR DELETE
        TO authenticated
        USING (public.can_write_regulacao_catalogo());
    ELSE
        RAISE NOTICE 'Tabela public.consultas_especialistas não encontrada; políticas ignoradas.';
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 7. BLINDAGEM DE RPC DIRETA: processar_fila_espera_consultas
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.processar_fila_espera_consultas(p_procedimento_id UUID)
RETURNS VOID AS $$
DECLARE
    v_available INTEGER;
    v_total INTEGER;
    r RECORD;
BEGIN
    -- Impede invocação direta via RPC por usuários Somente Leitura ou não autorizados,
    -- mantendo execução transparente quando disparada internamente por triggers (pg_trigger_depth() > 0).
    IF pg_trigger_depth() = 0
       AND auth.role() <> 'service_role'
       AND NOT public.can_write_regulacao_acompanhar()
    THEN
        RAISE EXCEPTION 'Acesso negado: perfil em modo somente leitura não pode processar a fila de espera.';
    END IF;

    FOR r IN
        SELECT id, appointment_date, quantity, priority
          FROM public.consultas_agendamentos
         WHERE procedimento_id = p_procedimento_id
           AND status = 'Fila de espera'
         ORDER BY
            CASE WHEN priority = 'Urgência' THEN 0 ELSE 1 END ASC,
            COALESCE(solicitation_date, appointment_date, created_at::date) ASC,
            created_at ASC
    LOOP
        SELECT available_quantity, total_quantity
          INTO v_available, v_total
          FROM public.consultas_procedimentos
         WHERE id = p_procedimento_id;

        IF v_available >= r.quantity THEN
            UPDATE public.consultas_agendamentos
               SET status = 'Aguardando Data'
             WHERE id = r.id;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

REVOKE ALL ON FUNCTION public.processar_fila_espera_consultas(UUID) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.processar_fila_espera_consultas(UUID) TO authenticated, service_role;

-- Recarregar cache do PostgREST
NOTIFY pgrst, 'reload schema';

/* ============================================================================
   SCRIPT DE REVERSÃO (ROLLBACK) — SOMENTE SE NECESSÁRIO EM EMERGÊNCIA
   ============================================================================
   -- 1. consultas_agendamentos
   DROP POLICY IF EXISTS "consultas_agendamentos_select_authorized" ON public.consultas_agendamentos;
   DROP POLICY IF EXISTS "consultas_agendamentos_insert_operational" ON public.consultas_agendamentos;
   DROP POLICY IF EXISTS "consultas_agendamentos_update_operational" ON public.consultas_agendamentos;
   DROP POLICY IF EXISTS "consultas_agendamentos_delete_gestor" ON public.consultas_agendamentos;
   CREATE POLICY "Allow read access to authenticated users on consultas_agendamentos" ON public.consultas_agendamentos FOR SELECT TO authenticated USING (true);
   CREATE POLICY "Allow write access to authenticated users on consultas_agendamentos" ON public.consultas_agendamentos FOR ALL TO authenticated USING (true) WITH CHECK (true);

   -- 2. consultas_solicitacoes_cancelamento
   DROP POLICY IF EXISTS "consultas_cancelamentos_select_authorized" ON public.consultas_solicitacoes_cancelamento;
   DROP POLICY IF EXISTS "consultas_cancelamentos_insert_operational" ON public.consultas_solicitacoes_cancelamento;
   DROP POLICY IF EXISTS "consultas_cancelamentos_update_gestor" ON public.consultas_solicitacoes_cancelamento;
   DROP POLICY IF EXISTS "consultas_cancelamentos_delete_gestor" ON public.consultas_solicitacoes_cancelamento;
   CREATE POLICY "Todos autenticados podem consultar solicitações" ON public.consultas_solicitacoes_cancelamento FOR SELECT TO authenticated USING (true);
   CREATE POLICY "Usuários autenticados podem inserir solicitações" ON public.consultas_solicitacoes_cancelamento FOR INSERT TO authenticated WITH CHECK (true);
   CREATE POLICY "Usuários autenticados podem atualizar solicitações" ON public.consultas_solicitacoes_cancelamento FOR UPDATE TO authenticated USING (true);

   -- 3. consultas_pacientes
   DROP POLICY IF EXISTS "consultas_pacientes_select_authorized" ON public.consultas_pacientes;
   DROP POLICY IF EXISTS "consultas_pacientes_insert_authorized" ON public.consultas_pacientes;
   DROP POLICY IF EXISTS "consultas_pacientes_update_authorized" ON public.consultas_pacientes;
   DROP POLICY IF EXISTS "consultas_pacientes_delete_authorized" ON public.consultas_pacientes;
   CREATE POLICY "Allow read access to authenticated users on consultas_pacientes" ON public.consultas_pacientes FOR SELECT TO authenticated USING (true);
   CREATE POLICY "Allow write access to authenticated users on consultas_pacientes" ON public.consultas_pacientes FOR ALL TO authenticated USING (true) WITH CHECK (true);

   -- 4. consultas_vagas
   DROP POLICY IF EXISTS "consultas_vagas_select_authenticated" ON public.consultas_vagas;
   DROP POLICY IF EXISTS "consultas_vagas_insert_authorized" ON public.consultas_vagas;
   DROP POLICY IF EXISTS "consultas_vagas_update_authorized" ON public.consultas_vagas;
   DROP POLICY IF EXISTS "consultas_vagas_delete_authorized" ON public.consultas_vagas;
   CREATE POLICY "Allow read access to authenticated users on consultas_vagas" ON public.consultas_vagas FOR SELECT TO authenticated USING (true);
   CREATE POLICY "Allow write access to authenticated users on consultas_vagas" ON public.consultas_vagas FOR ALL TO authenticated USING (true) WITH CHECK (true);

   -- 5. consultas_procedimentos & consultas_especialistas
   DROP POLICY IF EXISTS "consultas_procedimentos_select" ON public.consultas_procedimentos;
   DROP POLICY IF EXISTS "consultas_procedimentos_insert_authorized" ON public.consultas_procedimentos;
   DROP POLICY IF EXISTS "consultas_procedimentos_update_authorized" ON public.consultas_procedimentos;
   DROP POLICY IF EXISTS "consultas_procedimentos_delete_authorized" ON public.consultas_procedimentos;
   CREATE POLICY "consultas_procedimentos_select" ON public.consultas_procedimentos FOR SELECT TO authenticated USING (true);
   CREATE POLICY "consultas_procedimentos_write" ON public.consultas_procedimentos FOR ALL TO authenticated
     USING (public.is_admin() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND ('parent_regulacao' = ANY(permissions) OR role = 'admin')));

   DROP POLICY IF EXISTS "consultas_especialistas_select" ON public.consultas_especialistas;
   DROP POLICY IF EXISTS "consultas_especialistas_insert_authorized" ON public.consultas_especialistas;
   DROP POLICY IF EXISTS "consultas_especialistas_update_authorized" ON public.consultas_especialistas;
   DROP POLICY IF EXISTS "consultas_especialistas_delete_authorized" ON public.consultas_especialistas;
   CREATE POLICY "Permitir acesso completo a consultas_especialistas" ON public.consultas_especialistas FOR ALL USING (true) WITH CHECK (true);

   NOTIFY pgrst, 'reload schema';
============================================================================ */

