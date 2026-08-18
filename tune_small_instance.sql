-- ====================================================================
-- OTIMIZAÇÃO DE CPU PARA A INSTÂNCIA SMALL (t4g.small)
-- ====================================================================

-- 1. LIMPAR CONEXÕES E QUERIES TRAVADAS DA APLICAÇÃO (AUTHENTICATOR)
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE usename = 'authenticator'
  AND (state LIKE 'idle in transaction%' OR query_start < now() - interval '5 seconds')
  AND pid <> pg_backend_pid();

-- 2. AJUSTAR TIMEOUTS DE CONSULTAS LENTAS
ALTER DATABASE postgres SET idle_in_transaction_session_timeout = '10s';
ALTER DATABASE postgres SET statement_timeout = '15s';

-- 3. EXECUTAR ANALYZE EM TODAS AS TABELAS PRINCIPAIS
ANALYZE public.profiles;
ANALYZE public.vehicles;
ANALYZE public.vehicle_schedules;
ANALYZE public.diarias_eventos;
ANALYZE public.consultas_agendamentos;
ANALYZE public.consultas_pacientes;
ANALYZE public.consultas_procedimentos;
ANALYZE public.licitacao_processos;
ANALYZE public.purchase_orders;

-- 4. DIAGNÓSTICO: MOSTRAR CONSULTAS QUE AINDA ESTÃO EM EXECUÇÃO
SELECT 
    pid, 
    usename, 
    backend_type,
    state, 
    now() - query_start AS duration, 
    substring(query, 1, 120) AS query_preview
FROM pg_stat_activity 
WHERE state != 'idle' 
  AND pid <> pg_backend_pid()
ORDER BY duration DESC;
