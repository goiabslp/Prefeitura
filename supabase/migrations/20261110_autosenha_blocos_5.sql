-- ============================================================================
-- MIGRATION: FILA INTELIGENTE POR BLOCOS DE 5 E AVALIAÇÃO IMEDIATA (AUTOSENHA)
-- Data: 2026-11-10
-- Rotas: /AutoSenha/PSF1/Controle, /AutoSenha/PSF2, /AutoSenha/UPA/Controle
-- Objetivo:
--   1. Criar tabela public.autosenha_blocos e vincular senhas por bloco/posição.
--   2. Implementar organização dinâmica em blocos de 5 na sequência:
--      Especial -> Prioritário -> Especial -> Prioritário -> Normal,
--      com fechamento automático ao atingir 5 pacientes e criação do próximo bloco.
--   3. Executar emissão e chamada de senhas de forma transacional no backend
--      (pg_advisory_xact_lock + SELECT ... FOR UPDATE SKIP LOCKED) para impedir
--      conflitos e chamadas duplicadas entre guichês diferentes.
--   4. Ampliar rastreamento de Avaliações Imediatas (fora dos blocos).
-- ============================================================================

-- 1. TABELA DE BLOCOS DE FILA (BLOCOS CONSECUTIVOS DE 5 PACIENTES)
CREATE TABLE IF NOT EXISTS public.autosenha_blocos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unidade_id TEXT NOT NULL REFERENCES public.autosenha_unidades(id) ON DELETE RESTRICT,
    data_operacional DATE NOT NULL DEFAULT (timezone('America/Sao_Paulo', now())::date),
    numero_bloco INT NOT NULL CHECK (numero_bloco >= 1),
    status TEXT NOT NULL DEFAULT 'EM_FORMACAO' CHECK (status IN ('EM_FORMACAO', 'FECHADO')),
    total_pacientes INT NOT NULL DEFAULT 0 CHECK (total_pacientes >= 0 AND total_pacientes <= 5),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    closed_at TIMESTAMPTZ,
    CONSTRAINT uq_autosenha_bloco_unidade_data_num UNIQUE (unidade_id, data_operacional, numero_bloco)
);

CREATE INDEX IF NOT EXISTS idx_autosenha_blocos_unidade_data
    ON public.autosenha_blocos (unidade_id, data_operacional DESC, numero_bloco ASC);

-- 2. COLUNAS ADICIONAIS EM autosenha_senhas E autosenha_avaliacoes_urgentes
DO $$
BEGIN
    IF to_regclass('public.autosenha_senhas') IS NOT NULL THEN
        ALTER TABLE public.autosenha_senhas
            ADD COLUMN IF NOT EXISTS bloco_id UUID REFERENCES public.autosenha_blocos(id) ON DELETE SET NULL,
            ADD COLUMN IF NOT EXISTS bloco_numero INT,
            ADD COLUMN IF NOT EXISTS bloco_status TEXT DEFAULT 'EM_FORMACAO' CHECK (bloco_status IN ('EM_FORMACAO', 'FECHADO')),
            ADD COLUMN IF NOT EXISTS posicao_bloco INT,
            ADD COLUMN IF NOT EXISTS posicao_provisoria BOOLEAN DEFAULT true,
            ADD COLUMN IF NOT EXISTS paciente_id UUID,
            ADD COLUMN IF NOT EXISTS paciente_cpf TEXT,
            ADD COLUMN IF NOT EXISTS paciente_cartao_sus TEXT;

        CREATE INDEX IF NOT EXISTS idx_autosenha_senhas_fila_bloco
            ON public.autosenha_senhas (unidade_id, data_operacional, status, bloco_numero ASC, posicao_bloco ASC, created_at ASC);
    END IF;

    IF to_regclass('public.autosenha_avaliacoes_urgentes') IS NOT NULL THEN
        ALTER TABLE public.autosenha_avaliacoes_urgentes
            ADD COLUMN IF NOT EXISTS paciente_id UUID,
            ADD COLUMN IF NOT EXISTS paciente_cpf TEXT,
            ADD COLUMN IF NOT EXISTS encaminhado_em TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS atendido_por TEXT;

        CREATE INDEX IF NOT EXISTS idx_autosenha_urgentes_unidade_created
            ON public.autosenha_avaliacoes_urgentes (unidade_id, created_at DESC);
    END IF;
END $$;

-- 3. RLS GRANULAR PARA public.autosenha_blocos
DO $$
BEGIN
    IF to_regclass('public.autosenha_blocos') IS NOT NULL THEN
        ALTER TABLE public.autosenha_blocos ENABLE ROW LEVEL SECURITY;
        REVOKE ALL ON public.autosenha_blocos FROM anon;

        DROP POLICY IF EXISTS "autosenha_blocos_select_unit" ON public.autosenha_blocos;
        DROP POLICY IF EXISTS "autosenha_blocos_write_unit" ON public.autosenha_blocos;

        CREATE POLICY "autosenha_blocos_select_unit"
            ON public.autosenha_blocos FOR SELECT
            TO authenticated
            USING (public.can_read_autosenha_unit(unidade_id));

        CREATE POLICY "autosenha_blocos_write_unit"
            ON public.autosenha_blocos FOR ALL
            TO authenticated
            USING (public.can_write_autosenha_unit(unidade_id))
            WITH CHECK (public.can_write_autosenha_unit(unidade_id));
    END IF;

    -- Habilitar Realtime na tabela de blocos
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.autosenha_blocos;
    EXCEPTION WHEN duplicate_object THEN
        NULL;
    END;
END $$;

-- 4. FUNÇÃO INTERNA DE REORGANIZAÇÃO DINÂMICA DE UM BLOCO DE 5
-- Sequência preferencial: 1-ESPECIAL, 2-PRIORITARIO, 3-ESPECIAL, 4-PRIORITARIO, 5-NORMAL
CREATE OR REPLACE FUNCTION public.reorganizar_bloco_5_autosenha(p_bloco_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_bloco RECORD;
    v_slots text[] := ARRAY['ESPECIAL', 'PRIORITARIO', 'ESPECIAL', 'PRIORITARIO', 'NORMAL'];
    v_usadas uuid[] := ARRAY[]::uuid[];
    v_posicoes_fixas int[] := ARRAY[]::int[];
    v_slot_idx int;
    v_pref text;
    v_ordem_busca text[];
    v_tipo text;
    v_escolhida_id uuid;
    v_total int;
    v_fechar boolean;
BEGIN
    SELECT * INTO v_bloco FROM public.autosenha_blocos WHERE id = p_bloco_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN;
    END IF;

    -- Impede reorganização convencional em blocos já fechados
    IF v_bloco.status = 'FECHADO' THEN
        RETURN;
    END IF;

    SELECT COUNT(*)::int INTO v_total FROM public.autosenha_senhas WHERE bloco_id = p_bloco_id;
    v_fechar := (v_total >= 5);

    -- Senhas do bloco que já saíram de AGUARDANDO mantêm suas posições originais
    SELECT COALESCE(array_agg(posicao_bloco), ARRAY[]::int[])
      INTO v_posicoes_fixas
      FROM public.autosenha_senhas
     WHERE bloco_id = p_bloco_id
       AND status <> 'AGUARDANDO'
       AND posicao_bloco IS NOT NULL;

    -- Atribui as posições livres de 1..5 seguindo a sequência preferencial
    FOR v_slot_idx IN 1..5 LOOP
        IF v_slot_idx = ANY(v_posicoes_fixas) THEN
            CONTINUE;
        END IF;

        v_pref := v_slots[v_slot_idx];
        IF v_pref = 'ESPECIAL' THEN
            v_ordem_busca := ARRAY['ESPECIAL', 'PRIORITARIO', 'NORMAL'];
        ELSIF v_pref = 'PRIORITARIO' THEN
            v_ordem_busca := ARRAY['PRIORITARIO', 'ESPECIAL', 'NORMAL'];
        ELSE
            v_ordem_busca := ARRAY['NORMAL', 'ESPECIAL', 'PRIORITARIO'];
        END IF;

        v_escolhida_id := NULL;
        FOREACH v_tipo IN ARRAY v_ordem_busca LOOP
            SELECT s.id
              INTO v_escolhida_id
              FROM public.autosenha_senhas s
             WHERE s.bloco_id = p_bloco_id
               AND s.status = 'AGUARDANDO'
               AND s.prioridade_tipo = v_tipo
               AND NOT (s.id = ANY(v_usadas))
             ORDER BY s.created_at ASC, s.numero_sequencial ASC
             LIMIT 1;

            EXIT WHEN v_escolhida_id IS NOT NULL;
        END LOOP;

        IF v_escolhida_id IS NOT NULL THEN
            v_usadas := array_append(v_usadas, v_escolhida_id);
            UPDATE public.autosenha_senhas
               SET posicao_bloco = v_slot_idx,
                   bloco_status = CASE WHEN v_fechar THEN 'FECHADO' ELSE 'EM_FORMACAO' END,
                   posicao_provisoria = NOT v_fechar
             WHERE id = v_escolhida_id;
        END IF;
    END LOOP;

    -- Atualiza cabeçalho do bloco (fecha em 5 e cria automaticamente o próximo bloco)
    IF v_fechar THEN
        UPDATE public.autosenha_senhas
           SET bloco_status = 'FECHADO',
               posicao_provisoria = false
         WHERE bloco_id = p_bloco_id;

        UPDATE public.autosenha_blocos
           SET total_pacientes = LEAST(v_total, 5),
               status = 'FECHADO',
               closed_at = COALESCE(closed_at, timezone('utc'::text, now()))
         WHERE id = p_bloco_id;

        INSERT INTO public.autosenha_blocos (unidade_id, data_operacional, numero_bloco, status, total_pacientes)
        VALUES (v_bloco.unidade_id, v_bloco.data_operacional, v_bloco.numero_bloco + 1, 'EM_FORMACAO', 0)
        ON CONFLICT (unidade_id, data_operacional, numero_bloco) DO NOTHING;
    ELSE
        UPDATE public.autosenha_blocos
           SET total_pacientes = v_total,
               status = 'EM_FORMACAO'
         WHERE id = p_bloco_id;
    END IF;
END;
$$;

-- 5. RPC TRANSACIONAL DE EMISSÃO DE SENHA NO BLOCO DE 5
CREATE OR REPLACE FUNCTION public.emitir_senha_bloco5(
    p_unidade_id text,
    p_cidadao_nome text,
    p_prioridade_tipo text,
    p_prioridade_categoria text DEFAULT NULL,
    p_guiche text DEFAULT 'Recepção',
    p_atendente_id uuid DEFAULT NULL,
    p_atendente_nome text DEFAULT 'Recepção',
    p_paciente_id uuid DEFAULT NULL,
    p_paciente_cpf text DEFAULT NULL,
    p_paciente_cartao_sus text DEFAULT NULL
)
RETURNS public.autosenha_senhas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_hoje date := (timezone('America/Sao_Paulo', now())::date);
    v_bloco RECORD;
    v_max_bloco int;
    v_seq int;
    v_prefix text;
    v_numero text;
    v_nova_id uuid;
    v_result public.autosenha_senhas;
BEGIN
    IF NOT public.can_write_autosenha_unit(p_unidade_id) THEN
        RAISE EXCEPTION 'Acesso negado: usuário sem permissão operacional nesta unidade.' USING ERRCODE = '42501';
    END IF;

    IF p_prioridade_tipo NOT IN ('NORMAL', 'PRIORITARIO', 'ESPECIAL') THEN
        RAISE EXCEPTION 'Classificação inválida para emissão de senha em bloco.' USING ERRCODE = '22023';
    END IF;

    IF COALESCE(trim(p_cidadao_nome), '') = '' THEN
        RAISE EXCEPTION 'Nome do cidadão é obrigatório.' USING ERRCODE = '22023';
    END IF;

    -- Lock transacional exclusivo por unidade/dia
    PERFORM pg_advisory_xact_lock(hashtext('autosenha_emissao_' || p_unidade_id || '_' || v_hoje::text));

    -- Encontra bloco em formação com vaga (< 5)
    SELECT *
      INTO v_bloco
      FROM public.autosenha_blocos
     WHERE unidade_id = p_unidade_id
       AND data_operacional = v_hoje
       AND status = 'EM_FORMACAO'
       AND total_pacientes < 5
     ORDER BY numero_bloco ASC
     LIMIT 1
     FOR UPDATE;

    IF NOT FOUND THEN
        SELECT COALESCE(MAX(numero_bloco), 0)
          INTO v_max_bloco
          FROM public.autosenha_blocos
         WHERE unidade_id = p_unidade_id
           AND data_operacional = v_hoje;

        INSERT INTO public.autosenha_blocos (unidade_id, data_operacional, numero_bloco, status, total_pacientes)
        VALUES (p_unidade_id, v_hoje, v_max_bloco + 1, 'EM_FORMACAO', 0)
        RETURNING * INTO v_bloco;
    END IF;

    SELECT COALESCE(COUNT(*), 0)::int + 1
      INTO v_seq
      FROM public.autosenha_senhas
     WHERE unidade_id = p_unidade_id
       AND data_operacional = v_hoje
       AND prioridade_tipo = p_prioridade_tipo;

    v_prefix := CASE
        WHEN p_prioridade_tipo = 'ESPECIAL' THEN 'E'
        WHEN p_prioridade_tipo = 'PRIORITARIO' THEN 'P'
        ELSE 'N'
    END;
    v_numero := v_prefix || lpad(v_seq::text, 3, '0');

    INSERT INTO public.autosenha_senhas (
        unidade_id,
        numero,
        numero_sequencial,
        data_operacional,
        paciente_id,
        paciente_cpf,
        paciente_cartao_sus,
        cidadao_nome,
        prioridade_tipo,
        prioridade_categoria,
        status,
        bloco_id,
        bloco_numero,
        bloco_status,
        posicao_bloco,
        posicao_provisoria,
        guiche,
        atendente_id,
        atendente_nome,
        call_count
    ) VALUES (
        p_unidade_id,
        v_numero,
        v_seq,
        v_hoje,
        p_paciente_id,
        p_paciente_cpf,
        p_paciente_cartao_sus,
        trim(p_cidadao_nome),
        p_prioridade_tipo,
        p_prioridade_categoria,
        'AGUARDANDO',
        v_bloco.id,
        v_bloco.numero_bloco,
        'EM_FORMACAO',
        v_bloco.total_pacientes + 1,
        true,
        COALESCE(p_guiche, 'Recepção'),
        p_atendente_id,
        COALESCE(p_atendente_nome, 'Recepção'),
        0
    )
    RETURNING id INTO v_nova_id;

    PERFORM public.reorganizar_bloco_5_autosenha(v_bloco.id);

    SELECT * INTO v_result FROM public.autosenha_senhas WHERE id = v_nova_id;

    INSERT INTO public.autosenha_auditoria (
        unidade_id, senha_id, senha_numero, acao, descricao, detalhes, usuario_id, usuario_nome
    ) VALUES (
        p_unidade_id,
        v_result.id,
        v_result.numero,
        'EMISSAO',
        format('Senha %s emitida para %s no Bloco %s (Posição %s)', v_result.numero, v_result.cidadao_nome, v_result.bloco_numero, v_result.posicao_bloco),
        to_jsonb(v_result),
        p_atendente_id,
        COALESCE(p_atendente_nome, 'Recepção')
    );

    RETURN v_result;
END;
$$;

-- 6. RPC TRANSACIONAL ANTI-COLISÃO DE CHAMADA DO PRÓXIMO CIDADÃO
CREATE OR REPLACE FUNCTION public.chamar_proxima_senha_autosenha(
    p_unidade_id text,
    p_guiche text DEFAULT 'Recepção',
    p_operador_id uuid DEFAULT NULL,
    p_operador_nome text DEFAULT 'Atendente'
)
RETURNS public.autosenha_senhas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_hoje date := (timezone('America/Sao_Paulo', now())::date);
    v_agora timestamptz := timezone('utc'::text, now());
    v_escolhida public.autosenha_senhas;
    v_wait_sec int;
BEGIN
    IF NOT public.can_write_autosenha_unit(p_unidade_id) THEN
        RAISE EXCEPTION 'Acesso negado: usuário sem permissão operacional nesta unidade.' USING ERRCODE = '42501';
    END IF;

    -- SELECT ... FOR UPDATE SKIP LOCKED impede que dois guichês chamem a mesma senha simultaneamente
    SELECT *
      INTO v_escolhida
      FROM public.autosenha_senhas
     WHERE unidade_id = p_unidade_id
       AND data_operacional = v_hoje
       AND status = 'AGUARDANDO'
     ORDER BY bloco_numero ASC NULLS LAST, posicao_bloco ASC NULLS LAST, created_at ASC
     LIMIT 1
     FOR UPDATE SKIP LOCKED;

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    v_wait_sec := COALESCE(
        v_escolhida.wait_time_first_call_seconds,
        GREATEST(0, floor(extract(epoch FROM (v_agora - v_escolhida.created_at)))::int)
    );

    UPDATE public.autosenha_senhas
       SET status = 'CHAMANDO',
           guiche = COALESCE(p_guiche, 'Recepção'),
           atendente_id = p_operador_id,
           atendente_nome = COALESCE(p_operador_nome, 'Atendente'),
           first_called_at = COALESCE(first_called_at, v_agora),
           last_called_at = v_agora,
           call_count = COALESCE(call_count, 0) + 1,
           wait_time_first_call_seconds = v_wait_sec
     WHERE id = v_escolhida.id
     RETURNING * INTO v_escolhida;

    INSERT INTO public.autosenha_chamadas (
        senha_id, unidade_id, numero_chamada, tipo_evento, guiche, operador_id, operador_nome, timestamp_chamada
    ) VALUES (
        v_escolhida.id,
        p_unidade_id,
        v_escolhida.call_count,
        'CHAMADA_INICIAL',
        v_escolhida.guiche,
        p_operador_id,
        COALESCE(p_operador_nome, 'Atendente'),
        v_agora
    );

    INSERT INTO public.autosenha_auditoria (
        unidade_id, senha_id, senha_numero, acao, descricao, detalhes, usuario_id, usuario_nome
    ) VALUES (
        p_unidade_id,
        v_escolhida.id,
        v_escolhida.numero,
        'CHAMADA',
        format('Senha %s (%s) chamada no %s [Bloco %s]', v_escolhida.numero, v_escolhida.cidadao_nome, v_escolhida.guiche, COALESCE(v_escolhida.bloco_numero::text, '-')),
        jsonb_build_object('senha', to_jsonb(v_escolhida), 'guiche', v_escolhida.guiche),
        p_operador_id,
        COALESCE(p_operador_nome, 'Atendente')
    );

    RETURN v_escolhida;
END;
$$;

