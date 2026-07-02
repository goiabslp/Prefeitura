-- Adiciona a coluna de avatar à tabela profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar text;
