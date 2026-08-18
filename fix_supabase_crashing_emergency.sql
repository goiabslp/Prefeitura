-- ====================================================================
-- SCRIPT DE EMERGÊNCIA (VERSÃO SEGURA PARA O SUPABASE SQL EDITOR)
-- ====================================================================

-- 1. CRIAR FUNÇÃO IS_ADMIN COM 'SECURITY DEFINER'
-- (Evita recursão infinita RLS ao checar se o usuário é admin)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, anon, service_role;


-- 2. CORRIGIR POLÍTICAS RLS NA TABELA PROFILES (Causador principal das quedas)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Enable update for users based on id" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;

-- Leitura sem subquery recursiva
CREATE POLICY "Enable read access for authenticated users" 
ON public.profiles FOR SELECT 
TO authenticated 
USING (true);

-- Atualização sem subquery recursiva (usa a função is_admin segura)
CREATE POLICY "Enable update for users based on id" 
ON public.profiles FOR UPDATE 
TO authenticated
USING (auth.uid() = id OR public.is_admin())
WITH CHECK (auth.uid() = id OR public.is_admin());

-- Inserção de perfil
CREATE POLICY "Users can insert their own profile" 
ON public.profiles FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = id);


-- 3. CORRIGIR POLÍTICAS RLS EM SECTORS E JOBS
ALTER TABLE public.sectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read sectors" ON public.sectors;
DROP POLICY IF EXISTS "Admin insert sectors" ON public.sectors;
DROP POLICY IF EXISTS "Read jobs" ON public.jobs;
DROP POLICY IF EXISTS "Admin insert jobs" ON public.jobs;

CREATE POLICY "Read sectors" ON public.sectors FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin insert sectors" ON public.sectors FOR INSERT TO authenticated WITH CHECK (public.is_admin());

CREATE POLICY "Read jobs" ON public.jobs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin insert jobs" ON public.jobs FOR INSERT TO authenticated WITH CHECK (public.is_admin());


-- 4. CRIAR ÍNDICES CHAVE DE PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_profiles_id_role ON public.profiles(id, role);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- Licitações
CREATE INDEX IF NOT EXISTS idx_licitacao_processos_status ON public.licitacao_processos(status);
CREATE INDEX IF NOT EXISTS idx_licitacao_processos_created_at ON public.licitacao_processos(created_at DESC);

-- Diárias
CREATE INDEX IF NOT EXISTS idx_diarias_eventos_user_id ON public.diarias_eventos(user_id);
CREATE INDEX IF NOT EXISTS idx_diarias_eventos_created_at ON public.diarias_eventos(created_at DESC);


-- 5. ATUALIZAR VERSÃO DE COLLATION
ALTER DATABASE postgres REFRESH COLLATION VERSION;

SELECT 'Correção executada com sucesso!' AS resultado;
