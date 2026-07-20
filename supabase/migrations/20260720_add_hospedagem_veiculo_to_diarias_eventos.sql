-- Adicionar colunas de hospedagem, veículo e distância para diárias/eventos
ALTER TABLE public.diarias_eventos
ADD COLUMN IF NOT EXISTS hospedagem BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS hospedagem_dias INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS veiculo VARCHAR(255),
ADD COLUMN IF NOT EXISTS veiculo_outro VARCHAR(255),
ADD COLUMN IF NOT EXISTS distancia INTEGER DEFAULT 0;
