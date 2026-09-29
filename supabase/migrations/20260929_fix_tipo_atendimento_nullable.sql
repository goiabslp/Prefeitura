-- ==============================================================================
-- Migration: 20260929_fix_tipo_atendimento_nullable.sql
-- Objetivo: Criar / ajustar as colunas de Tipo de Atendimento, Prestador,
--           Município, Convênio e Vaga ID nas tabelas de Regulação,
--           garantindo que tipo_atendimento seja anulável (NULL) enquanto a
--           solicitação estiver na fila de espera (aguardando agendamento).
-- ==============================================================================

-- 1. Garantir que as colunas existam na tabela consultas_vagas
ALTER TABLE public.consultas_vagas 
  ADD COLUMN IF NOT EXISTS tipo_atendimento text NOT NULL DEFAULT 'INTERNO',
  ADD COLUMN IF NOT EXISTS prestador text,
  ADD COLUMN IF NOT EXISTS municipio text DEFAULT 'São José do Goiabal - MG',
  ADD COLUMN IF NOT EXISTS convenio text;

-- 2. Garantir que as colunas existam na tabela consultas_agendamentos (como anuláveis)
ALTER TABLE public.consultas_agendamentos 
  ADD COLUMN IF NOT EXISTS tipo_atendimento text,
  ADD COLUMN IF NOT EXISTS prestador text,
  ADD COLUMN IF NOT EXISTS municipio text,
  ADD COLUMN IF NOT EXISTS convenio text,
  ADD COLUMN IF NOT EXISTS vaga_id uuid;

-- 3. Se a coluna tipo_atendimento ou municipio na tabela consultas_agendamentos tiver NOT NULL ou DEFAULT antigo, remove de forma segura
DO $$ 
BEGIN
  -- Remover NOT NULL de tipo_atendimento caso tenha sido criada com essa restrição
  BEGIN
    ALTER TABLE public.consultas_agendamentos ALTER COLUMN tipo_atendimento DROP NOT NULL;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- Remover DEFAULT de tipo_atendimento caso tenha sido criada com default 'INTERNO'
  BEGIN
    ALTER TABLE public.consultas_agendamentos ALTER COLUMN tipo_atendimento DROP DEFAULT;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- Remover DEFAULT de municipio caso exista
  BEGIN
    ALTER TABLE public.consultas_agendamentos ALTER COLUMN municipio DROP DEFAULT;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;

-- 4. Atualizar solicitações existentes que estão na Fila de espera / sem data marcada para ficarem com tipo_atendimento NULL
UPDATE public.consultas_agendamentos
SET 
  tipo_atendimento = NULL,
  prestador = NULL,
  convenio = NULL,
  vaga_id = NULL
WHERE (status IN ('Fila de espera', 'Aguardando Data') OR appointment_date IS NULL)
  AND status NOT IN ('Agendado', 'Realizado');

-- 5. Criar índices para acelerar consultas e filtros
CREATE INDEX IF NOT EXISTS idx_consultas_vagas_tipo_atendimento 
  ON public.consultas_vagas (tipo_atendimento);

CREATE INDEX IF NOT EXISTS idx_consultas_agendamentos_tipo_atendimento 
  ON public.consultas_agendamentos (tipo_atendimento);

CREATE INDEX IF NOT EXISTS idx_consultas_agendamentos_vaga_id 
  ON public.consultas_agendamentos (vaga_id);

-- 6. Recarregar o cache do schema no PostgREST
NOTIFY pgrst, 'reload schema';
