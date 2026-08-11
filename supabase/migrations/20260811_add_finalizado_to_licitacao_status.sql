-- Migração: Adicionar 'Finalizado' à restrição CHECK de status em licitacao_processos
ALTER TABLE public.licitacao_processos DROP CONSTRAINT IF EXISTS licitacao_processos_status_check;

ALTER TABLE public.licitacao_processos ADD CONSTRAINT licitacao_processos_status_check 
  CHECK (status IN ('Rascunho', 'Aguardando Assinatura', 'Assinado', 'Em Análise', 'Concluído', 'Finalizado', 'Rejeitado'));
