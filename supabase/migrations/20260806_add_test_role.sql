-- Adiciona a coluna de tipo de perfil de teste à tabela profiles (para administradores realizarem testes de perfil)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS test_role text;
