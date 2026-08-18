-- PASSO 1: EXECUTAR ESTA LINHA SOZINHA PRIMEIRO NO SQL EDITOR
-- Isso desativa temporariamente o RLS da tabela profiles e LIBERA INSTANTANEAMENTE todos os travamentos e a CPU!
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;


-- PASSO 2: EXECUTAR ESTE BLOCO LOGO EM SEGUIDA
-- Cria a função segura que não faz subquery recursiva
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


-- PASSO 3: RECRIAR AS POLÍTICAS RLS DE FORMA CORRETA E REATIVAR
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Enable update for users based on id" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;

CREATE POLICY "Enable read access for authenticated users" 
ON public.profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Enable update for users based on id" 
ON public.profiles FOR UPDATE TO authenticated
USING (auth.uid() = id OR public.is_admin())
WITH CHECK (auth.uid() = id OR public.is_admin());

CREATE POLICY "Users can insert their own profile" 
ON public.profiles FOR INSERT TO authenticated 
WITH CHECK (auth.uid() = id);

-- Reativar RLS com as novas políticas seguras
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- PASSO 4: ATUALIZAR VERSÃO DE COLLATION
ALTER DATABASE postgres REFRESH COLLATION VERSION;
