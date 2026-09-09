-- ==============================================================================
-- MIGRATION: Remoção Permanente dos Módulos Tarefas, Obras e Agricultura
-- Data: 2026-09-09
-- ==============================================================================

-- 1. Dropar Tabelas e Estruturas Exclusivas do Módulo Tarefas
DROP TABLE IF EXISTS public.task_assignments CASCADE;
DROP TABLE IF EXISTS public.task_comments CASCADE;
DROP TABLE IF EXISTS public.task_attachments CASCADE;
DROP TABLE IF EXISTS public.tasks CASCADE;

-- 2. Dropar Tabelas e Estruturas Exclusivas do Módulo Obras
DROP TABLE IF EXISTS public.obras_execucoes CASCADE;
DROP TABLE IF EXISTS public.obras_medicoes CASCADE;
DROP TABLE IF EXISTS public.obras_anexos CASCADE;
DROP TABLE IF EXISTS public.obras CASCADE;

-- 3. Dropar Tabelas e Estruturas Exclusivas do Módulo Agricultura
DROP TABLE IF EXISTS public.agriculture_schedulings CASCADE;
DROP TABLE IF EXISTS public.agriculture_requests CASCADE;
DROP TABLE IF EXISTS public.agriculture_registrations CASCADE;
DROP TABLE IF EXISTS public.agricultura_solicitacoes CASCADE;
DROP TABLE IF EXISTS public.agricultura_agendamentos CASCADE;

-- 4. Limpeza de Permissões Residuais nos Perfis de Usuários
UPDATE public.profiles
SET permissions = array_remove(
  array_remove(
    array_remove(
      array_remove(
        array_remove(permissions, 'parent_agricultura'),
        'parent_obras'
      ),
      'parent_tarefas'
    ),
    'sub_tarefas_nova'
  ),
  'sub_tarefas_minhas'
)
WHERE permissions IS NOT NULL;

-- 5. Limpeza de Permissões na Tabela users (caso exista sincronização de backup)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
    UPDATE public.users
    SET permissions = array_remove(
      array_remove(
        array_remove(
          array_remove(
            array_remove(permissions, 'parent_agricultura'),
            'parent_obras'
          ),
          'parent_tarefas'
        ),
        'sub_tarefas_nova'
      ),
      'sub_tarefas_minhas'
    )
    WHERE permissions IS NOT NULL;
  END IF;
END $$;
