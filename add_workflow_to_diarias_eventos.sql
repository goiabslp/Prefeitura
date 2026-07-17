-- Adicionar novas colunas para controle do fluxo (Motorista -> Gestor -> Administrador -> Concluído)
ALTER TABLE public.diarias_eventos
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'aguardando_gestor',
ADD COLUMN IF NOT EXISTS justificativa_gestor TEXT,
ADD COLUMN IF NOT EXISTS comprovantes_gestor JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS valor_diaria NUMERIC,
ADD COLUMN IF NOT EXISTS relatorio_viagem TEXT;

-- Garantir que as políticas de RLS permitam leitura e atualização destas novas colunas para usuários autenticados
-- As políticas existentes são gerais para leitura e atualização, então nenhuma alteração adicional nas políticas de RLS é estritamente necessária.
