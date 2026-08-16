-- Migration: Add agente_saude column to consultas_pacientes table
ALTER TABLE public.consultas_pacientes ADD COLUMN IF NOT EXISTS agente_saude TEXT;
