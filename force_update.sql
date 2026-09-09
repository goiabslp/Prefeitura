-- Script de verificação de permissões de admin
SELECT username, permissions FROM profiles WHERE role = 'admin';

