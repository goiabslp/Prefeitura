-- SCRIPT DE CORREÇÃO DE TRIGGER PARA AGENDAMENTO DE CONSULTAS
-- Execute este script no SQL Editor do Supabase se desejar atualizar as triggers do banco.

-- 1. Atualiza a função BEFORE trigger em consultas_agendamentos para permitir transição para 'Agendado' sem interferência de cotas legadas
CREATE OR REPLACE FUNCTION public.handle_consultas_vagas_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Se for Retorno, garantir que is_retorno seja TRUE
    IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
        IF (NEW.status = 'Retorno') THEN
            NEW.is_retorno := TRUE;
        END IF;
    END IF;

    -- Em atualizações explícitas para Agendado ou Realizado, permite a transição diretamente
    IF (TG_OP = 'UPDATE' AND NEW.status IN ('Agendado', 'Realizado', 'Não Realizado', 'Cancelado')) THEN
        RETURN NEW;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Recriar a trigger BEFORE
DROP TRIGGER IF EXISTS trigger_handle_consultas_vagas ON public.consultas_agendamentos;
CREATE TRIGGER trigger_handle_consultas_vagas
    BEFORE INSERT OR UPDATE ON public.consultas_agendamentos
    FOR EACH ROW EXECUTE FUNCTION public.handle_consultas_vagas_change();
