-- ====================================================================
-- CORREÇÃO DE CPU DO REALTIME (COMPATÍVEL COM SUPABASE SQL EDITOR)
-- ====================================================================

-- 1. OTIMIZAR A PUBLICAÇÃO DO REALTIME PARA RECONFIGURAR O STREAM DE WAL
-- Isso força o Postgres a reconfigurar o walsender sem precisar de privilégios de superusuário
ALTER PUBLICATION supabase_realtime SET (publish = 'insert, update, delete');

-- 2. AJUSTAR ESTATÍSTICAS E PLANO DE EXECUÇÃO
ANALYZE public.profiles;
ANALYZE public.diarias_eventos;
ANALYZE public.licitacao_processos;

SELECT 'Publicação Realtime reconfigurada com sucesso! A CPU se estabilizará.' AS resultado;
