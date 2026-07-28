-- Adicionar novas colunas para o controle de início automático e validação de saída
ALTER TABLE public.diarias_eventos
ADD COLUMN IF NOT EXISTS modo_inicio VARCHAR(50),
ADD COLUMN IF NOT EXISTS saida_validada BOOLEAN DEFAULT FALSE;
