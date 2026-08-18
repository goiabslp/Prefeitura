-- 1. DESTRANCAR AS CONEXÕES DA APLICAÇÃO (AUTHENTICATOR) PRESAS EM TRANSAÇÃO
-- Isso solta na hora os bloqueios (locks) das tabelas 'vehicles' e 'vehicle_schedules'
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE usename = 'authenticator'
  AND (state LIKE 'idle in transaction%' OR query_start < now() - interval '5 seconds')
  AND pid <> pg_backend_pid();

-- 2. CRIAR ÍNDICES DE ALTA PERFORMANCE NAS TABELAS DE VEÍCULOS E AGENDAMENTOS
-- Evita que consultas e updates travem no futuro
CREATE INDEX IF NOT EXISTS idx_vehicles_id ON public.vehicles(id);
CREATE INDEX IF NOT EXISTS idx_vehicle_schedules_status ON public.vehicle_schedules(status);
CREATE INDEX IF NOT EXISTS idx_vehicle_schedules_vehicle_id ON public.vehicle_schedules(vehicle_id);

SELECT 'Travamentos liberados e índices das tabelas de veículos otimizados!' AS resultado;
