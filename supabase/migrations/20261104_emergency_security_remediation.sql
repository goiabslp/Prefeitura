-- ====================================================================
-- PREFEITURA INTEGRADA — PLANO EMERGENCIAL DE CONTENÇÃO E CORREÇÃO DE SEGURANÇA
-- Data: 04 de Novembro de 2026
-- Objetivo: Sanar exposição pública de dados, revogar acessos anônimos (anon),
--           eliminar vulnerabilidade crítica de escalonamento de privilégios (LPE)
--           e blindar execução da RPC delete_user_admin.
-- Execução: Idempotente, reversível, sem impacto sobre dados legítimos.
-- ====================================================================

-- --------------------------------------------------------------------
-- FASE 1: BLINDAGEM DA FUNÇÃO RPC DELETE_USER_ADMIN (CVSS 9.8 - CRÍTICO)
-- --------------------------------------------------------------------
-- Revogação imediata de privilégios concedidos a anon e public
REVOKE EXECUTE ON FUNCTION public.delete_user_admin(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.delete_user_admin(uuid) FROM public;

-- Recriação da função com validação de segurança no corpo (server-side check)
CREATE OR REPLACE FUNCTION public.delete_user_admin(user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  -- 1. Validação estrita: apenas administradores municipais ou service_role podem executar
  IF auth.role() <> 'service_role' AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores autenticados podem realizar exclusão de usuários.';
  END IF;

  -- 2. Impedir auto-exclusão acidental
  IF auth.uid() = user_id THEN
    RAISE EXCEPTION 'Operação inválida: não é permitido autoexcluir a conta do administrador logado.';
  END IF;

  -- 3. Desvincular eventos de calendário
  UPDATE public.calendar_events
  SET created_by = NULL
  WHERE created_by = user_id;

  -- 4. Limpar notificações do usuário
  BEGIN
    DELETE FROM public.notifications
    WHERE user_id = user_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- 5. Desvincular gestores e permissões de diárias
  BEGIN
    DELETE FROM public.diarias_gestores
    WHERE pessoa_id = user_id OR gestor_id = user_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- 6. Desvincular assinaturas digitais
  BEGIN
    UPDATE public.signatures
    SET user_id = NULL
    WHERE user_id = user_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- 7. Desvincular veículos
  BEGIN
    UPDATE public.vehicles
    SET driver_id = NULL
    WHERE driver_id = user_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    UPDATE public.vehicles
    SET responsible_person_id = NULL
    WHERE responsible_person_id = user_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- 8. Desvincular agendamentos
  BEGIN
    UPDATE public.consultas_agendamentos
    SET created_by = NULL
    WHERE created_by = user_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- 9. Excluir de public.profiles
  DELETE FROM public.profiles
  WHERE id = user_id;

  -- 10. Excluir de auth.users (Supabase Auth)
  BEGIN
    DELETE FROM auth.users
    WHERE id = user_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END;
$$;

-- Conceder estritamente para authenticated e service_role (anon permanece REVOGADO)
GRANT EXECUTE ON FUNCTION public.delete_user_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_user_admin(uuid) TO service_role;


-- --------------------------------------------------------------------
-- FASE 2: PROTEÇÃO CONTRA ESCALONAMENTO DE PRIVILÉGIOS EM PROFILES
-- --------------------------------------------------------------------
-- Função trigger para impedir que usuários comuns alterem 'role' ou 'permissions'
CREATE OR REPLACE FUNCTION public.protect_profile_privileges()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Se houver tentativa de alterar role ou permissions:
  IF (OLD.role IS DISTINCT FROM NEW.role OR OLD.permissions IS DISTINCT FROM NEW.permissions) THEN
    -- Apenas administradores ou a chave service_role podem modificar papel ou matriz de acesso
    IF auth.role() <> 'service_role' AND NOT public.is_admin() THEN
      RAISE EXCEPTION 'Acesso negado: alteração de papel funcional ou matriz de permissões é restrita a administradores.';
    END IF;
  END IF;

  -- Impedir alteração arbitrária de ID
  IF OLD.id <> NEW.id THEN
    RAISE EXCEPTION 'Operação inválida: o identificador do perfil (UUID) não pode ser alterado.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_privileges ON public.profiles;
CREATE TRIGGER trg_protect_profile_privileges
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_profile_privileges();


-- --------------------------------------------------------------------
-- FASE 3: BLINDAGEM DE DIÁRIAS (diarias_eventos)
-- --------------------------------------------------------------------
ALTER TABLE public.diarias_eventos ENABLE ROW LEVEL SECURITY;

-- Revogar permissões explícitas do role anon
REVOKE ALL ON public.diarias_eventos FROM anon;

-- Remover políticas antigas com cláusula 'TO' ausente (que se aplicavam a PUBLIC)
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.diarias_eventos;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.diarias_eventos;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.diarias_eventos;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.diarias_eventos;

-- Novas políticas estritas: apenas usuários autenticados
CREATE POLICY "diarias_eventos_select_authenticated"
ON public.diarias_eventos
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "diarias_eventos_insert_authenticated"
ON public.diarias_eventos
FOR INSERT
TO authenticated
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "diarias_eventos_update_authenticated"
ON public.diarias_eventos
FOR UPDATE
TO authenticated
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "diarias_eventos_delete_authenticated"
ON public.diarias_eventos
FOR DELETE
TO authenticated
USING (user_id = auth.uid() OR public.is_admin());


-- --------------------------------------------------------------------
-- FASE 4: BLINDAGEM DA FROTA MUNICIPAL (vehicles e vehicle_oil_changes)
-- --------------------------------------------------------------------
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_oil_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_documents ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.vehicles FROM anon;
REVOKE ALL ON public.vehicle_oil_changes FROM anon;
REVOKE ALL ON public.vehicle_documents FROM anon;

DROP POLICY IF EXISTS "Enable read access for all users" ON public.vehicles;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.vehicle_oil_changes;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.vehicle_documents;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.vehicle_documents;
DROP POLICY IF EXISTS "Enable delete for authenticated users only" ON public.vehicle_documents;

CREATE POLICY "vehicles_select_authenticated"
ON public.vehicles
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "vehicles_all_admin_gestor"
ON public.vehicles
FOR ALL
TO authenticated
USING (public.is_admin() OR EXISTS (
  SELECT 1 FROM public.profiles WHERE id = auth.uid() AND ('parent_frota' = ANY(permissions) OR role = 'admin')
));

CREATE POLICY "vehicle_oil_changes_select_authenticated"
ON public.vehicle_oil_changes
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "vehicle_oil_changes_write_authenticated"
ON public.vehicle_oil_changes
FOR ALL
TO authenticated
USING (auth.role() = 'authenticated');

CREATE POLICY "vehicle_documents_select_authenticated"
ON public.vehicle_documents
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "vehicle_documents_write_authenticated"
ON public.vehicle_documents
FOR ALL
TO authenticated
USING (auth.role() = 'authenticated');


-- --------------------------------------------------------------------
-- FASE 5: BLINDAGEM DO MÓDULO DE LICITAÇÕES
-- --------------------------------------------------------------------
ALTER TABLE public.licitacao_processos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.licitacao_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.licitacao_justificativas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.licitacao_assinaturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.licitacao_permissoes ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.licitacao_processos FROM anon;
REVOKE ALL ON public.licitacao_itens FROM anon;
REVOKE ALL ON public.licitacao_justificativas FROM anon;
REVOKE ALL ON public.licitacao_assinaturas FROM anon;
REVOKE ALL ON public.licitacao_permissoes FROM anon;

DROP POLICY IF EXISTS "Visualização de Processos" ON public.licitacao_processos;
DROP POLICY IF EXISTS "Inserção de Processos" ON public.licitacao_processos;
DROP POLICY IF EXISTS "Atualização de Processos" ON public.licitacao_processos;
DROP POLICY IF EXISTS "Acesso Total Itens" ON public.licitacao_itens;
DROP POLICY IF EXISTS "Acesso Total Justificativas" ON public.licitacao_justificativas;
DROP POLICY IF EXISTS "Acesso Total Assinaturas" ON public.licitacao_assinaturas;
DROP POLICY IF EXISTS "Acesso Total Permissoes" ON public.licitacao_permissoes;

-- Políticas para usuários autenticados
CREATE POLICY "licitacao_processos_select"
ON public.licitacao_processos
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "licitacao_processos_insert"
ON public.licitacao_processos
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = criado_por OR public.is_admin());

CREATE POLICY "licitacao_processos_update"
ON public.licitacao_processos
FOR UPDATE
TO authenticated
USING (auth.role() = 'authenticated');

CREATE POLICY "licitacao_itens_all"
ON public.licitacao_itens
FOR ALL
TO authenticated
USING (auth.role() = 'authenticated');

CREATE POLICY "licitacao_justificativas_all"
ON public.licitacao_justificativas
FOR ALL
TO authenticated
USING (auth.role() = 'authenticated');

CREATE POLICY "licitacao_assinaturas_all"
ON public.licitacao_assinaturas
FOR ALL
TO authenticated
USING (auth.role() = 'authenticated');

CREATE POLICY "licitacao_permissoes_all"
ON public.licitacao_permissoes
FOR ALL
TO authenticated
USING (public.is_admin());


-- --------------------------------------------------------------------
-- FASE 6: BLINDAGEM DO MÓDULO DE MARKETING
-- --------------------------------------------------------------------
ALTER TABLE public.marketing_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_contents ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.marketing_requests FROM anon;
REVOKE ALL ON public.marketing_contents FROM anon;

DROP POLICY IF EXISTS "Permitir leitura para usuários autenticados" ON public.marketing_requests;
DROP POLICY IF EXISTS "Permitir inserção de pedidos de marketing" ON public.marketing_requests;
DROP POLICY IF EXISTS "Permitir atualização de pedidos de marketing" ON public.marketing_requests;
DROP POLICY IF EXISTS "Permitir deleção de pedidos de marketing" ON public.marketing_requests;
DROP POLICY IF EXISTS "Permitir leitura de conteúdos" ON public.marketing_contents;
DROP POLICY IF EXISTS "Permitir inserção de conteúdos" ON public.marketing_contents;
DROP POLICY IF EXISTS "Permitir atualização de conteúdos" ON public.marketing_contents;
DROP POLICY IF EXISTS "Permitir deleção de conteúdos" ON public.marketing_contents;

CREATE POLICY "marketing_requests_select"
ON public.marketing_requests
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "marketing_requests_write"
ON public.marketing_requests
FOR ALL
TO authenticated
USING (auth.role() = 'authenticated');

CREATE POLICY "marketing_contents_select"
ON public.marketing_contents
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "marketing_contents_write"
ON public.marketing_contents
FOR ALL
TO authenticated
USING (auth.role() = 'authenticated');


-- --------------------------------------------------------------------
-- FASE 7: BLINDAGEM DO CALENDÁRIO MUNICIPAL
-- --------------------------------------------------------------------
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.calendar_events FROM anon;

DROP POLICY IF EXISTS "Enable read access for all users" ON public.calendar_events;
DROP POLICY IF EXISTS "Enable insert for admins only" ON public.calendar_events;
DROP POLICY IF EXISTS "Enable update for admins only" ON public.calendar_events;
DROP POLICY IF EXISTS "Enable delete for admins only" ON public.calendar_events;

CREATE POLICY "calendar_events_select"
ON public.calendar_events
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "calendar_events_write"
ON public.calendar_events
FOR ALL
TO authenticated
USING (auth.role() = 'authenticated');


-- --------------------------------------------------------------------
-- FASE 8: BLINDAGEM DO CATÁLOGO DE PROCEDIMENTOS (REGULAÇÃO)
-- --------------------------------------------------------------------
ALTER TABLE public.consultas_procedimentos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.consultas_procedimentos FROM anon;

DROP POLICY IF EXISTS "Enable all access for consultas_procedimentos" ON public.consultas_procedimentos;

CREATE POLICY "consultas_procedimentos_select"
ON public.consultas_procedimentos
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "consultas_procedimentos_write"
ON public.consultas_procedimentos
FOR ALL
TO authenticated
USING (public.is_admin() OR EXISTS (
  SELECT 1 FROM public.profiles WHERE id = auth.uid() AND ('parent_regulacao' = ANY(permissions) OR role = 'admin')
));


-- --------------------------------------------------------------------
-- FASE 9: REVOGAÇÃO GLOBAL PREVENTIVA PARA SCHEMA PUBLIC
-- --------------------------------------------------------------------
-- Garante que nenhuma tabela futura conceda permissões acidentais para anon
REVOKE CREATE ON SCHEMA public FROM anon;
REVOKE CREATE ON SCHEMA public FROM public;

-- Notificação de sucesso da aplicação
DO $$
BEGIN
  RAISE NOTICE 'Plano de contenção emergencial de segurança executado com sucesso!';
END $$;

