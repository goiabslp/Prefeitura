-- Consulta de verificação de permissões
SELECT * FROM pg_enum WHERE enumtypid = 'app_permission'::regtype;

