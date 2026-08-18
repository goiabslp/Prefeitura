-- CANCELAR CONSULTAS DE USUÁRIOS/APLICAÇÃO SEM TENTAR CANCELAR PROCESSOS DO SISTEMA SUPABASE
SELECT pg_cancel_backend(pid)
FROM pg_stat_activity
WHERE state != 'idle'
  AND pid <> pg_backend_pid()
  AND usename NOT IN ('supabase_admin', 'postgres', 'supabase_auth_admin', 'supabase_storage_admin', 'authenticator')
  AND query_start < now() - interval '5 seconds';

SELECT 'Consultas de usuários canceladas com sucesso!' AS resultado;
