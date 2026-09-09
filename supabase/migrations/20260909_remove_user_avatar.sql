-- Remoção permanente da coluna de avatar da tabela profiles
ALTER TABLE profiles DROP COLUMN IF EXISTS avatar;
