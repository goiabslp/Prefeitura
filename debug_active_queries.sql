-- MOSTRAR QUAIS CONSULTAS ESTÃO CONSUMINDO A CPU (96%) E AS 35 CONEXÕES
SELECT 
    pid, 
    now() - query_start AS duration, 
    state, 
    usename, 
    query 
FROM pg_stat_activity 
WHERE state != 'idle' 
  AND pid <> pg_backend_pid()
ORDER BY duration DESC 
LIMIT 10;
