-- Adiciona a coluna available_for_consultation na tabela de veículos
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS available_for_consultation text DEFAULT 'Sim';

-- Atualiza veículos existentes para garantir o valor padrão 'Sim' caso nulo
UPDATE public.vehicles SET available_for_consultation = 'Sim' WHERE available_for_consultation IS NULL;
