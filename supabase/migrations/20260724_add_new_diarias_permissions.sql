-- Inserir as novas permissões do módulo de Diárias na tabela global_module_settings
INSERT INTO public.global_module_settings (module_key, label, is_enabled, is_enabled_mobile, parent_key, order_index, description)
VALUES
  ('parent_diarias_editor', 'Nova Solicitação', true, false, 'parent_diarias', 1, 'Permissão para criar novas solicitações de diárias'),
  ('parent_diarias_historico', 'Histórico', true, false, 'parent_diarias', 2, 'Permissão para consultar o histórico de diárias'),
  ('parent_diarias_novo_evento', 'Novo Evento', true, false, 'parent_diarias', 3, 'Permissão para cadastrar novas viagens (eventos)'),
  ('parent_diarias_lancamentos', 'Lançamentos', true, false, 'parent_diarias', 4, 'Permissão para gerenciar os lançamentos de diárias'),
  ('parent_diarias_gestores', 'Gestores', true, false, 'parent_diarias', 5, 'Permissão para vincular gestores aos servidores')
ON CONFLICT (module_key) DO UPDATE SET
  label = EXCLUDED.label,
  parent_key = EXCLUDED.parent_key,
  order_index = EXCLUDED.order_index,
  description = EXCLUDED.description;
