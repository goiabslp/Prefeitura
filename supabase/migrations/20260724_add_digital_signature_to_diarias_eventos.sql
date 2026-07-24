-- Adicionar coluna digital_signature para armazenar metadados de assinatura eletrônica do administrador
ALTER TABLE public.diarias_eventos
ADD COLUMN IF NOT EXISTS digital_signature JSONB;
