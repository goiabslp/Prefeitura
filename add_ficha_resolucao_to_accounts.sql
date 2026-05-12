-- Adiciona os campos ficha e resolucao na tabela purchase_accounts
ALTER TABLE IF EXISTS purchase_accounts
ADD COLUMN IF NOT EXISTS ficha TEXT,
ADD COLUMN IF NOT EXISTS resolucao TEXT;
