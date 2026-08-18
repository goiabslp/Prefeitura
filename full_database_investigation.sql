-- ====================================================================
-- RELATÓRIO COMPLETO DE INVESTIGAÇÃO DE PERFORMANCE DO BANCO
-- Execute este script no SQL Editor para gerar o diagnóstico detalhado!
-- ====================================================================

-- 1. CONSULTAS E PROCESSOS ATIVOS AGORA NO BANCO
SELECT 
    pid, 
    usename, 
    client_addr,
    backend_type,
    state, 
    now() - query_start AS duration, 
    substring(query, 1, 150) AS query_preview
FROM pg_stat_activity 
WHERE state != 'idle' 
  AND pid <> pg_backend_pid()
ORDER BY duration DESC;

-- 2. TABELAS COM MAIOR CONSUMO E FULL TABLE SCANS (LEITURAS SEM ÍNDICE)
SELECT 
    schemaname,
    relname AS table_name,
    seq_scan AS full_table_scans,
    seq_tup_read AS rows_read_without_index,
    idx_scan AS index_scans,
    n_dead_tup AS dead_tuples
FROM pg_stat_user_tables
ORDER BY seq_tup_read DESC
LIMIT 10;

-- 3. STATUS DOS SLOTS DE REPLICAÇÃO E WALSENDER
SELECT 
    slot_name, 
    plugin, 
    slot_type, 
    active, 
    active_pid,
    restart_lsn,
    confirmed_flush_lsn
FROM pg_replication_slots;

-- 4. CONEXÕES POR USUÁRIO E ESTADO
SELECT 
    usename, 
    state, 
    count(*) AS total_connections 
FROM pg_stat_activity 
GROUP BY usename, state 
ORDER BY total_connections DESC;
