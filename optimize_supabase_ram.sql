-- ====================================================================
-- OTIMIZAÇÃO DE MEMÓRIA (RAM) E ESTABILIDADE DO BANCO SUPABASE
-- Execute este script no SQL Editor do Supabase para reduzir o uso de RAM!
-- ====================================================================

-- 1. CORRIGIR RECURSÃO INFINITA RLS (Principal causador de estouro de RAM/OOM)
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

DROP POLICY IF EXISTS "Enable update for users based on id" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.profiles;

CREATE POLICY "Enable read access for authenticated users" ON public.profiles
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Enable update for users based on id" ON public.profiles
FOR UPDATE TO authenticated
USING (auth.uid() = id OR public.is_admin())
WITH CHECK (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS "Admin insert sectors" ON public.sectors;
DROP POLICY IF EXISTS "Admin insert jobs" ON public.jobs;

CREATE POLICY "Admin insert sectors" ON public.sectors FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Admin insert jobs" ON public.jobs FOR INSERT TO authenticated WITH CHECK (public.is_admin());


-- 2. CRIAR ÍNDICES CHAVE (Evita carregar tabelas inteiras na RAM / Full Table Scans)
CREATE INDEX IF NOT EXISTS idx_profiles_id_role ON public.profiles(id, role);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- Licitações
CREATE INDEX IF NOT EXISTS idx_licitacao_processos_status ON public.licitacao_processos(status);
CREATE INDEX IF NOT EXISTS idx_licitacao_processos_created_at ON public.licitacao_processos(created_at DESC);

-- Diárias
CREATE INDEX IF NOT EXISTS idx_diarias_eventos_user_id ON public.diarias_eventos(user_id);
CREATE INDEX IF NOT EXISTS idx_diarias_eventos_created_at ON public.diarias_eventos(created_at DESC);

-- Consultas / Pacientes
CREATE INDEX IF NOT EXISTS idx_consultas_pacientes_nome ON public.consultas_pacientes(nome);
CREATE INDEX IF NOT EXISTS idx_consultas_agendamentos_data ON public.consultas_agendamentos(data_consulta);

-- Abastecimento
CREATE INDEX IF NOT EXISTS idx_abastecimentos_date ON public.abastecimentos(date DESC);


-- 3. AJUSTAR TIMEOUTS DE CONEXÕES INATIVAS (Libera RAM presa por conexões fantasmas)
ALTER DATABASE postgres SET idle_in_transaction_session_timeout = '30s';
ALTER DATABASE postgres SET statement_timeout = '60s';


-- 4. EXECUTAR VACUUM E ANALYZE (Recupera RAM e reorganiza os índices do Postgres)
ANALYZE public.profiles;
ANALYZE public.licitacao_processos;
ANALYZE public.diarias_eventos;
ANALYZE public.abastecimentos;

SELECT 'Otimização de RAM concluída com sucesso!' AS resultado;
