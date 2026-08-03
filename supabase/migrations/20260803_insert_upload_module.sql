-- Migration: Inserir o módulo 'Upload Rápido' na tabela global_module_settings
-- Permite controlar o acesso ao módulo de Upload Rápido via Controle de Acesso Global

INSERT INTO public.global_module_settings (module_key, label, is_enabled, is_enabled_mobile, parent_key, order_index, description)
VALUES
  ('parent_upload', 'Upload Rápido', true, true, NULL, 16, 'Hub universal para envio rápido de documentos e comprovantes via QR Code')
ON CONFLICT (module_key) DO UPDATE SET
  label = EXCLUDED.label,
  parent_key = EXCLUDED.parent_key,
  order_index = EXCLUDED.order_index,
  description = EXCLUDED.description;
