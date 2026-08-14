-- Migration: Add sus_number column to consultas_pacientes table
ALTER TABLE public.consultas_pacientes ADD COLUMN IF NOT EXISTS sus_number TEXT;
