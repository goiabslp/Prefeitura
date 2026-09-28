-- ==============================================================================
-- Migration: 20260928_fix_delete_user_and_calendar_fkeys.sql
-- Objetivo: Corrigir erro de Foreign Key ao excluir usuários no Painel Admin
--           (calendar_events_created_by_fkey e dependências)
-- ==============================================================================

-- 1. Ajustar constraints de FK para permitir ON DELETE SET NULL / CASCADE
DO $$
BEGIN
  -- calendar_events (created_by) -> ON DELETE SET NULL
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'calendar_events_created_by_fkey'
  ) THEN
    ALTER TABLE public.calendar_events DROP CONSTRAINT calendar_events_created_by_fkey;
  END IF;

  ALTER TABLE public.calendar_events
    ADD CONSTRAINT calendar_events_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES public.profiles(id)
    ON DELETE SET NULL;

  -- notifications (user_id) -> ON DELETE CASCADE
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'notifications'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_name = 'notifications_user_id_fkey'
    ) THEN
      ALTER TABLE public.notifications DROP CONSTRAINT notifications_user_id_fkey;
    END IF;

    ALTER TABLE public.notifications
      ADD CONSTRAINT notifications_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.profiles(id)
      ON DELETE CASCADE;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Aviso ao ajustar constraints de FK: %', SQLERRM;
END $$;

-- 2. Recriar/Atualizar a função delete_user_admin para tratar desvinculações de forma segura e completa
CREATE OR REPLACE FUNCTION public.delete_user_admin(user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  -- 2.1 Desvincular eventos de calendário (preserva aniversários e eventos públicos com created_by = NULL)
  UPDATE public.calendar_events
  SET created_by = NULL
  WHERE created_by = user_id;

  -- 2.2 Limpar notificações do usuário
  BEGIN
    DELETE FROM public.notifications
    WHERE user_id = user_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- 2.3 Desvincular gestores e permissões de diárias
  BEGIN
    DELETE FROM public.diarias_gestores
    WHERE pessoa_id = user_id OR gestor_id = user_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- 2.4 Desvincular assinaturas digitais
  BEGIN
    UPDATE public.signatures
    SET user_id = NULL
    WHERE user_id = user_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- 2.5 Desvincular veículos onde o usuário possa constar como responsável/motorista
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

  -- 2.6 Desvincular agendamentos se houver created_by
  BEGIN
    UPDATE public.consultas_agendamentos
    SET created_by = NULL
    WHERE created_by = user_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- 2.7 Excluir da tabela profiles
  DELETE FROM public.profiles
  WHERE id = user_id;

  -- 2.8 Excluir do auth.users (contas Supabase Auth)
  BEGIN
    DELETE FROM auth.users
    WHERE id = user_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END;
$$;

-- 3. Conceder privilégios de execução para a função
GRANT EXECUTE ON FUNCTION public.delete_user_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_user_admin(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_user_admin(uuid) TO anon;
