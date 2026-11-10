-- ==============================================================================
-- Migration: Bloqueio de Solicitações Duplicadas no Módulo de Regulação
-- Rota principal: /Regulacao/NovoAgendamento
-- Objetivo: Impedir mais de uma solicitação ativa para a mesma combinação de
--           Paciente (ID ou CPF) e Procedimento (ID ou código), garantindo
--           integridade transacional (concorrência), preservação de histórico
--           e respeito às políticas RLS e autenticação.
-- ==============================================================================

-- 1. Garantir colunas auxiliares caso o ambiente ainda não as possua
ALTER TABLE public.consultas_agendamentos
ADD COLUMN IF NOT EXISTS solicitation_date DATE DEFAULT CURRENT_DATE,
ADD COLUMN IF NOT EXISTS appointment_time TIME,
ADD COLUMN IF NOT EXISTS is_retorno BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS retorno_tipo TEXT;

-- 2. Índice composto de suporte para consultas rápidas de duplicidade
CREATE INDEX IF NOT EXISTS idx_consultas_agendamentos_patient_proc_status
ON public.consultas_agendamentos (patient_id, procedimento_id, status);

-- 3. Restrição única parcial considerando apenas solicitações ativas
--    Executada de forma segura para não alterar nem excluir registros históricos existentes.
DO $$
BEGIN
    CREATE UNIQUE INDEX IF NOT EXISTS idx_consultas_agendamentos_unique_active
    ON public.consultas_agendamentos (patient_id, procedimento_id)
    WHERE status IS NOT NULL
      AND status NOT IN ('Cancelado', 'Cancelada', 'Realizado', 'Não Realizado');
EXCEPTION
    WHEN unique_violation THEN
        RAISE NOTICE 'Aviso: Foram detectados registros históricos duplicados ativos em consultas_agendamentos. Os registros existentes foram preservados intactos; novos cadastros duplicados serão bloqueados atomicamente pela trigger transacional.';
END $$;

-- 4. Função de trigger transacional com Advisory Lock (bloqueia envios simultâneos)
CREATE OR REPLACE FUNCTION public.prevent_duplicate_active_agendamento()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_should_check BOOLEAN := FALSE;
    v_patient_cpf TEXT;
    v_proc_code TEXT;
    v_existing RECORD;
    v_sol_date TEXT;
BEGIN
    -- Somente solicitações com status ativo participam do bloqueio de duplicidade.
    -- Solicitações encerradas (Cancelado, Realizado, Não Realizado) permitem nova solicitação.
    IF NEW.status IS NULL OR NEW.status IN ('Cancelado', 'Cancelada', 'Realizado', 'Não Realizado') THEN
        RETURN NEW;
    END IF;

    IF (TG_OP = 'INSERT') THEN
        v_should_check := TRUE;
    ELSIF (TG_OP = 'UPDATE') THEN
        -- Valida em UPDATE apenas se houve mudança de paciente, procedimento ou reativação de registro encerrado
        IF (
            OLD.patient_id IS DISTINCT FROM NEW.patient_id OR
            OLD.procedimento_id IS DISTINCT FROM NEW.procedimento_id OR
            OLD.status IN ('Cancelado', 'Cancelada', 'Realizado', 'Não Realizado')
        ) THEN
            v_should_check := TRUE;
        END IF;
    END IF;

    IF NOT v_should_check THEN
        RETURN NEW;
    END IF;

    -- Lock transacional atômico para impedir condições de corrida quando dois usuários tentam cadastrar juntos
    PERFORM pg_advisory_xact_lock(
        hashtext('agendamento_dup:' || COALESCE(NEW.patient_id::text, '') || ':' || COALESCE(NEW.procedimento_id::text, ''))
    );

    -- Obter CPF normalizado do paciente e código do procedimento
    SELECT NULLIF(regexp_replace(COALESCE(cpf, ''), '\D', '', 'g'), '')
    INTO v_patient_cpf
    FROM public.consultas_pacientes
    WHERE id = NEW.patient_id;

    SELECT NULLIF(btrim(COALESCE(code, '')), '')
    INTO v_proc_code
    FROM public.consultas_procedimentos
    WHERE id = NEW.procedimento_id;

    -- Se possuir CPF válido, aplicar também lock por CPF + código/procedimento
    IF v_patient_cpf IS NOT NULL AND length(v_patient_cpf) = 11 THEN
        PERFORM pg_advisory_xact_lock(
            hashtext('agendamento_cpf_dup:' || v_patient_cpf || ':' || COALESCE(v_proc_code, COALESCE(NEW.procedimento_id::text, '')))
        );
    END IF;

    -- Verificar existência de solicitação ativa para o mesmo paciente (ID ou CPF) e procedimento (ID ou código)
    SELECT
        a.id,
        a.status,
        a.solicitation_date,
        a.appointment_date,
        a.created_at
    INTO v_existing
    FROM public.consultas_agendamentos a
    LEFT JOIN public.consultas_pacientes p ON p.id = a.patient_id
    LEFT JOIN public.consultas_procedimentos pr ON pr.id = a.procedimento_id
    WHERE a.id IS DISTINCT FROM NEW.id
      AND a.status IS NOT NULL
      AND a.status NOT IN ('Cancelado', 'Cancelada', 'Realizado', 'Não Realizado')
      AND (
          a.patient_id = NEW.patient_id
          OR (
              v_patient_cpf IS NOT NULL
              AND length(v_patient_cpf) = 11
              AND regexp_replace(COALESCE(p.cpf, ''), '\D', '', 'g') = v_patient_cpf
          )
      )
      AND (
          a.procedimento_id = NEW.procedimento_id
          OR (
              v_proc_code IS NOT NULL
              AND NULLIF(btrim(COALESCE(pr.code, '')), '') = v_proc_code
          )
      )
    ORDER BY a.created_at DESC
    LIMIT 1;

    IF FOUND THEN
        v_sol_date := COALESCE(
            v_existing.solicitation_date::text,
            to_char(v_existing.created_at AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD')
        );

        RAISE EXCEPTION 'SOLICITACAO_DUPLICADA|%|%|%',
            v_existing.id,
            v_existing.status,
            COALESCE(v_sol_date, '')
        USING ERRCODE = '23505',
              DETAIL = 'Já existe uma solicitação cadastrada para este paciente e procedimento. Não é permitido realizar um pedido duplicado.';
    END IF;

    RETURN NEW;
END;
$$;

-- Nome iniciado com "a_" garante execução ANTES da trigger de vagas ("trigger_handle_consultas_vagas")
DROP TRIGGER IF EXISTS a_trigger_prevent_duplicate_agendamento ON public.consultas_agendamentos;
CREATE TRIGGER a_trigger_prevent_duplicate_agendamento
    BEFORE INSERT OR UPDATE ON public.consultas_agendamentos
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_duplicate_active_agendamento();

-- 5. Função RPC segura para consulta prévia de duplicidade no frontend
--    Retorna apenas metadados não sensíveis da solicitação ativa existente (se houver),
--    funcionando independentemente de setor do solicitante, mas restrita a usuários autenticados.
CREATE OR REPLACE FUNCTION public.verificar_solicitacao_ativa_duplicada(
    p_patient_id UUID,
    p_procedimento_id UUID,
    p_cpf TEXT DEFAULT NULL,
    p_proc_code TEXT DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    patient_id UUID,
    procedimento_id UUID,
    status TEXT,
    solicitation_date DATE,
    appointment_date DATE,
    appointment_time TEXT,
    priority TEXT,
    created_at TIMESTAMPTZ,
    is_retorno BOOLEAN,
    retorno_tipo TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_clean_cpf TEXT;
    v_clean_code TEXT;
BEGIN
    IF auth.role() NOT IN ('authenticated', 'service_role') THEN
        RAISE EXCEPTION 'Acesso negado: autenticação obrigatória.';
    END IF;

    v_clean_cpf := NULLIF(regexp_replace(COALESCE(p_cpf, ''), '\D', '', 'g'), '');
    IF v_clean_cpf IS NULL AND p_patient_id IS NOT NULL THEN
        SELECT NULLIF(regexp_replace(COALESCE(pac.cpf, ''), '\D', '', 'g'), '')
        INTO v_clean_cpf
        FROM public.consultas_pacientes pac
        WHERE pac.id = p_patient_id;
    END IF;

    v_clean_code := NULLIF(btrim(COALESCE(p_proc_code, '')), '');
    IF v_clean_code IS NULL AND p_procedimento_id IS NOT NULL THEN
        SELECT NULLIF(btrim(COALESCE(pr.code, '')), '')
        INTO v_clean_code
        FROM public.consultas_procedimentos pr
        WHERE pr.id = p_procedimento_id;
    END IF;

    RETURN QUERY
    SELECT
        a.id,
        a.patient_id,
        a.procedimento_id,
        a.status,
        a.solicitation_date,
        a.appointment_date,
        a.appointment_time::TEXT,
        a.priority,
        a.created_at,
        COALESCE(a.is_retorno, FALSE),
        a.retorno_tipo
    FROM public.consultas_agendamentos a
    LEFT JOIN public.consultas_pacientes p ON p.id = a.patient_id
    LEFT JOIN public.consultas_procedimentos pr ON pr.id = a.procedimento_id
    WHERE a.status IS NOT NULL
      AND a.status NOT IN ('Cancelado', 'Cancelada', 'Realizado', 'Não Realizado')
      AND (
          a.patient_id = p_patient_id
          OR (
              v_clean_cpf IS NOT NULL
              AND length(v_clean_cpf) = 11
              AND regexp_replace(COALESCE(p.cpf, ''), '\D', '', 'g') = v_clean_cpf
          )
      )
      AND (
          a.procedimento_id = p_procedimento_id
          OR (
              v_clean_code IS NOT NULL
              AND NULLIF(btrim(COALESCE(pr.code, '')), '') = v_clean_code
          )
      )
    ORDER BY a.created_at DESC
    LIMIT 1;
END;
$$;

-- Restringir execução da RPC exclusivamente a usuários autenticados e service_role (nunca anon)
REVOKE ALL ON FUNCTION public.verificar_solicitacao_ativa_duplicada(UUID, UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.verificar_solicitacao_ativa_duplicada(UUID, UUID, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.verificar_solicitacao_ativa_duplicada(UUID, UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verificar_solicitacao_ativa_duplicada(UUID, UUID, TEXT, TEXT) TO service_role;

-- Recarregar cache de schema do PostgREST
NOTIFY pgrst, 'reload schema';
