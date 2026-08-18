-- ====================================================================
-- CORREÇÃO DE MISMATCH DE VERSÃO DE COLLATION NO POSTGRESQL / SUPABASE
-- ====================================================================
-- Nota: O Supabase SQL Editor executa scripts dentro de um bloco de transação,
-- por isso 'REINDEX DATABASE' gera erro.
--
-- Execute apenas a linha abaixo no SQL Editor do Supabase para atualizar a versão:

ALTER DATABASE postgres REFRESH COLLATION VERSION;

SELECT 'Versão de collation atualizada com sucesso!' AS resultado;
