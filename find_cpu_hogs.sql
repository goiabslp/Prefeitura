-- 1. QUAIS PROCESSOS E CONSULTAS ESTÃO USANDO A CPU AGORA?
SELECT 
    pid, 
    usename, 
    backend_type,
    state, 
    now() - query_start AS duration, 
    query 
FROM pg_stat_activity 
WHERE state != 'idle' 
  AND pid <> pg_backend_pid()
ORDER BY duration DESC;

-- 2. QUAIS TABELAS ESTÃO TRANSMITINDO NO REALTIME (REPLICAÇÃO LOGICAL DO BANCO)?
SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
