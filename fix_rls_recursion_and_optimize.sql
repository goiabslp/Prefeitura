-- ====================================================================
-- SCRIPT DE CORREÇÃO DE RECURSÃO INFINITA E ESTABILIDADE DO BANCO
-- Execute este script no SQL Editor do Supabase para parar as quedas!
-- ====================================================================

-- 1. Criar uma função helper SECURITY DEFINER para verificar se o usuário é Admin.
-- O SECURITY DEFINER ignora o RLS ao checar o role, prevenindo o loop de recursão infinita!
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

-- 2. Corrigir as políticas de RLS na tabela PROFILES (que estavam gerando recursão infinita)
DROP POLICY IF EXISTS "Enable update for users based on id" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.profiles;

-- Política de leitura: usuários autenticados podem ler perfis
CREATE POLICY "Enable read access for authenticated users" ON public.profiles
FOR SELECT TO authenticated USING (true);

-- Política de atualização: usuário atualiza o próprio perfil ou se for Admin (via função is_admin sem recursão)
CREATE POLICY "Enable update for users based on id" ON public.profiles
FOR UPDATE TO authenticated
USING (auth.uid() = id OR public.is_admin())
WITH CHECK (auth.uid() = id OR public.is_admin());

-- 3. Corrigir políticas em SECTORS e JOBS para usar a função helper is_admin()
DROP POLICY IF EXISTS "Admin insert sectors" ON public.sectors;
DROP POLICY IF EXISTS "Admin insert jobs" ON public.jobs;

CREATE POLICY "Admin insert sectors" ON public.sectors FOR INSERT TO authenticated
WITH CHECK (public.is_admin());

CREATE POLICY "Admin insert jobs" ON public.jobs FOR INSERT TO authenticated
WITH CHECK (public.is_admin());

-- 4. Criar índices críticos para evitar High CPU / Full Table Scans
CREATE INDEX IF NOT EXISTS idx_profiles_id_role ON public.profiles(id, role);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- Finalização
SELECT 'Políticas RLS corrigidas com sucesso e recursão eliminada!' AS status;
