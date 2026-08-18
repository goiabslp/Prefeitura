-- ====================================================================
-- OTIMIZAÇÃO DE MEMÓRIA RAM PARA INSTÂNCIA MICRO (SEM INTERRUPÇÃO DE CONEXÃO)
-- ====================================================================

-- 1. AJUSTAR TIMEOUTS RÍGIDOS DE CONEXÃO (Libera conexões ociosas automaticamente após 10s)
ALTER DATABASE postgres SET idle_in_transaction_session_timeout = '10s';
ALTER DATABASE postgres SET statement_timeout = '20s';

-- 2. EXECUTAR ANALYZE PARA REORGANIZAR ESTATÍSTICAS E PLANO DE EXECUÇÃO
ANALYZE public.profiles;
ANALYZE public.licitacao_processos;
ANALYZE public.diarias_eventos;
ANALYZE public.abastecimentos;
ANALYZE public.purchase_orders;

SELECT 'Otimização e limites de timeout configurados com sucesso!' AS resultado;
