-- Execute este script no SQL Editor do Supabase para atualizar o tipo da coluna record_id.
-- Isso permite que a tabela aceite qualquer formato de ID (como IDs temporários baseados em timestamps ou inteiros),
-- evitando falhas de inserção e colisões de códigos de operação rápidos.

ALTER TABLE public.operation_codes 
ALTER COLUMN record_id TYPE TEXT;
