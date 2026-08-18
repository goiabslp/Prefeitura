-- ====================================================================
-- CORREÇÃO DE MISMATCH DE VERSÃO DE COLLATION NO POSTGRESQL / SUPABASE
-- ====================================================================
-- Este erro/aviso ocorre quando a biblioteca de collation do sistema operacional (glibc/ICU)
-- do servidor foi atualizada (ex: da versão 153.120 para 153.121).
--
-- Para resolver com segurança no Supabase (no SQL Editor):

-- 1. (Opcional, mas recomendado) Recriar os índices baseados em ordenação de texto/string para garantir integridade:
REINDEX DATABASE postgres;

-- 2. Atualizar a versão de collation registrada no banco de dados para a versão atual fornecida pelo SO:
ALTER DATABASE postgres REFRESH COLLATION VERSION;

SELECT 'Versão de collation atualizada com sucesso!' AS resultado;
