-- ====================================================================
-- MASTER SCRIPT DE ESTABILIZAÇÃO DE PERFORMANCE (SUPABASE MICRO 1GB)
-- ====================================================================

-- 1. DESTRANCAR TRANSAÇÕES DA APLICAÇÃO PRESAS OU ABORTADAS
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE usename = 'authenticator'
  AND (state LIKE 'idle in transaction%' OR query_start < now() - interval '5 seconds')
  AND pid <> pg_backend_pid();

-- 2. DEFINIR TIMEOUTS RÍGIDOS DE CONEXÃO E CONSULTAS
-- (Fecha conexões ociosas após 10s e aborta queries travadas após 15s)
ALTER DATABASE postgres SET idle_in_transaction_session_timeout = '10s';
ALTER DATABASE postgres SET statement_timeout = '15s';

-- 3. CRIAR ÍNDICES DE ALTA PERFORMANCE (Evita 100% de CPU por Full Table Scans)
CREATE INDEX IF NOT EXISTS idx_vehicles_id ON public.vehicles(id);
CREATE INDEX IF NOT EXISTS idx_vehicle_schedules_status ON public.vehicle_schedules(status);
CREATE INDEX IF NOT EXISTS idx_vehicle_schedules_vehicle_id ON public.vehicle_schedules(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_profiles_id_role ON public.profiles(id, role);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_diarias_eventos_user_id ON public.diarias_eventos(user_id);
CREATE INDEX IF NOT EXISTS idx_diarias_eventos_created_at ON public.diarias_eventos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON public.purchase_orders(status);

-- 4. OTIMIZAR ESTATÍSTICAS E PLANO DE EXECUÇÃO
ANALYZE public.profiles;
ANALYZE public.vehicles;
ANALYZE public.vehicle_schedules;
ANALYZE public.diarias_eventos;
ANALYZE public.licitacao_processos;
ANALYZE public.purchase_orders;

SELECT 'Plano de estabilização do banco de dados aplicado com sucesso!' AS resultado;
