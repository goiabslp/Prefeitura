-- ==============================================================================
-- SCRIPT DE ATUALIZAÇÃO DEFINITIVA DAS TRIGGERS DE AGENDAMENTO (SUPABASE)
-- Execute este script no SQL Editor do seu projeto Supabase
-- ==============================================================================

-- 1. Desativar/Remover triggers legadas que bloqueavam o agendamento
DROP TRIGGER IF EXISTS trigger_handle_consultas_vagas ON public.consultas_agendamentos;
DROP TRIGGER IF EXISTS trigger_handle_consultas_vagas_after ON public.consultas_agendamentos;
DROP TRIGGER IF EXISTS consultas_agendamentos_vagas_trigger ON public.consultas_agendamentos;

-- 2. Atualizar a função de validação BEFORE em consultas_agendamentos
-- Esta nova versão permite a transição para 'Agendado' sem travar em cotas legadas de 20%
CREATE OR REPLACE FUNCTION public.handle_consultas_vagas_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Se o status for Retorno, garante que a flag is_retorno seja TRUE
    IF (NEW.status = 'Retorno') THEN
        NEW.is_retorno := TRUE;
    END IF;

    -- Permite diretamente os status sem rebaixar para fila de espera
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Recriar a trigger BEFORE limpa
CREATE TRIGGER trigger_handle_consultas_vagas
    BEFORE INSERT OR UPDATE ON public.consultas_agendamentos
    FOR EACH ROW EXECUTE FUNCTION public.handle_consultas_vagas_change();

-- 4. Atualizar a função de recálculo de vagas para sincronizar procedimentos
CREATE OR REPLACE FUNCTION public.recalculate_procedimento_vagas(p_procedimento_id UUID)
RETURNS VOID AS $$
DECLARE
    v_total INTEGER;
    v_active_bookings INTEGER;
    v_available INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_total
    FROM public.consultas_vagas
    WHERE procedimento_id = p_procedimento_id;

    SELECT COALESCE(SUM(quantity), 0) INTO v_active_bookings
    FROM public.consultas_agendamentos
    WHERE procedimento_id = p_procedimento_id
      AND status IN ('Agendado', 'Realizado');

    v_available := GREATEST(0, v_total - v_active_bookings);

    UPDATE public.consultas_procedimentos
    SET total_quantity = v_total,
        available_quantity = v_available
    WHERE id = p_procedimento_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Recalcular todos os procedimentos existentes
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id FROM public.consultas_procedimentos LOOP
        PERFORM public.recalculate_procedimento_vagas(r.id);
    END LOOP;
END $$;

-- 6. Converter todos os agendamentos com status 'Aguardando Data' para 'Fila de espera'
UPDATE public.consultas_agendamentos
SET status = 'Fila de espera'
WHERE status = 'Aguardando Data';

