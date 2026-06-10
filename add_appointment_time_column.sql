-- Migration: Add appointment_time column to consultas_agendamentos
ALTER TABLE public.consultas_agendamentos ADD COLUMN IF NOT EXISTS appointment_time TIME;
