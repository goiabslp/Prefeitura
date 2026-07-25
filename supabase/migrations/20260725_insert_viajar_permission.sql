-- Inserir a nova permissão do módulo de Diárias na tabela global_module_settings
INSERT INTO public.global_module_settings (module_key, label, is_enabled, is_enabled_mobile, parent_key, order_index, description)
VALUES
  ('parent_diarias_viajar', 'Viajar', true, true, 'parent_diarias', 6, 'Permissão para iniciar e finalizar viagens em tempo real')
ON CONFLICT (module_key) DO UPDATE SET
  label = EXCLUDED.label,
  parent_key = EXCLUDED.parent_key,
  order_index = EXCLUDED.order_index,
  description = EXCLUDED.description;
