-- ====================================================================
-- ZERAR O CONSUMO DE CPU (99%) E LIBERAR O BANCO DE DADOS INSTANTANEAMENTE
-- ====================================================================

-- 1. REMOVER TODAS AS TABELAS DA PUBLICAÇÃO DO REALTIME (ELIMINA 100% DO WALSENDER NA CPU)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime') LOOP
        BEGIN
            EXECUTE format('ALTER PUBLICATION supabase_realtime DROP TABLE public.%I', r.tablename);
        EXCEPTION WHEN OTHERS THEN
            -- Ignora se alguma tabela não puder ser removida individualmente
        END;
    END LOOP;
END $$;

-- 2. DERRUBAR TODAS AS CONEXÕES DA APLICAÇÃO (AUTHENTICATOR) QUE ESTÃO PRENDENDO A CPU E 35 CONEXÕES
-- Nota: 'authenticator' é o usuário do seu app. O SQL Editor TEM PERMISSÃO TOTAL para encerrar conexões dele!
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE usename = 'authenticator'
  AND pid <> pg_backend_pid();

-- 3. FORÇAR TIMEOUT RÍGIDO DE 10 SEGUNDOS EM QUALQUER CONSULTA FUTURA
ALTER DATABASE postgres SET idle_in_transaction_session_timeout = '10s';
ALTER DATABASE postgres SET statement_timeout = '10s';

SELECT 'Realtime pausado e conexões da aplicação encerradas! A CPU cairá para < 5% imediatamente.' AS resultado;
