-- ==============================================================================
-- Migration: 20260928_fix_and_recalculate_consultas_cotas.sql
-- Objetivo: Corrigir contagem de cotas e vagas dos procedimentos de regulação
-- ==============================================================================

-- 1. Função de recálculo exato de cotas de um procedimento baseado nas tabelas reais
CREATE OR REPLACE FUNCTION public.recalculate_procedimento_vagas(p_procedimento_id UUID)
RETURNS VOID AS $$
DECLARE
    v_total INTEGER;
    v_active_bookings INTEGER;
    v_available INTEGER;
BEGIN
    -- Contagem de vagas cadastradas na tabela consultas_vagas
    SELECT COUNT(*) INTO v_total
    FROM public.consultas_vagas
    WHERE procedimento_id = p_procedimento_id
      AND status <> 'Cancelada';

    -- Contagem de agendamentos ativos que ocupam vaga
    SELECT COALESCE(SUM(quantity), 0) INTO v_active_bookings
    FROM public.consultas_agendamentos
    WHERE procedimento_id = p_procedimento_id
      AND status IN ('Solicitado', 'Agendado', 'Aguardando Data', 'Realizado', 'Retorno');

    -- Vagas disponíveis reais (nunca menor que zero)
    v_available := GREATEST(0, v_total - v_active_bookings);

    -- Atualizar procedimento
    UPDATE public.consultas_procedimentos
    SET total_quantity = v_total,
        available_quantity = v_available
    WHERE id = p_procedimento_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Recalcular todos os procedimentos existentes
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id FROM public.consultas_procedimentos LOOP
        PERFORM public.recalculate_procedimento_vagas(r.id);
    END LOOP;
END $$;
