-- Adiciona a coluna de status (para bloqueio) à tabela profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';
