-- ==============================================================================
-- Migration: 20260928_add_tipo_atendimento_to_consultas.sql
-- Objetivo: Adicionar Tipo de Atendimento (INTERNO/EXTERNO), Prestador,
--           Município e Convênio nas tabelas de Vagas e Agendamentos da Regulação
-- ==============================================================================

-- 1. Adicionar colunas na tabela consultas_vagas
ALTER TABLE public.consultas_vagas 
  ADD COLUMN IF NOT EXISTS tipo_atendimento text NOT NULL DEFAULT 'INTERNO',
  ADD COLUMN IF NOT EXISTS prestador text,
  ADD COLUMN IF NOT EXISTS municipio text DEFAULT 'São José do Goiabal - MG',
  ADD COLUMN IF NOT EXISTS convenio text;

-- 2. Adicionar colunas na tabela consultas_agendamentos
ALTER TABLE public.consultas_agendamentos
  ADD COLUMN IF NOT EXISTS tipo_atendimento text NOT NULL DEFAULT 'INTERNO',
  ADD COLUMN IF NOT EXISTS prestador text,
  ADD COLUMN IF NOT EXISTS municipio text DEFAULT 'São José do Goiabal - MG',
  ADD COLUMN IF NOT EXISTS convenio text,
  ADD COLUMN IF NOT EXISTS vaga_id uuid;

-- 3. Criar índices para acelerar consultas e relatórios territoriais
CREATE INDEX IF NOT EXISTS idx_consultas_vagas_tipo_atendimento 
  ON public.consultas_vagas (tipo_atendimento);

CREATE INDEX IF NOT EXISTS idx_consultas_vagas_municipio 
  ON public.consultas_vagas (municipio);

CREATE INDEX IF NOT EXISTS idx_consultas_agendamentos_tipo_atendimento 
  ON public.consultas_agendamentos (tipo_atendimento);

CREATE INDEX IF NOT EXISTS idx_consultas_agendamentos_municipio 
  ON public.consultas_agendamentos (municipio);

CREATE INDEX IF NOT EXISTS idx_consultas_agendamentos_prestador 
  ON public.consultas_agendamentos (prestador);

-- 4. Notificar PostgREST para recarregar o schema cache
NOTIFY pgrst, 'reload schema';
