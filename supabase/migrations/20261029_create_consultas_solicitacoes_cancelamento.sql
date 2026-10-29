-- =========================================================================================
-- MIGRAÇÃO: Criar tabela de solicitações de cancelamento de consultas/regulação
-- =========================================================================================

CREATE TABLE IF NOT EXISTS public.consultas_solicitacoes_cancelamento (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agendamento_id UUID NOT NULL REFERENCES public.consultas_agendamentos(id) ON DELETE CASCADE,
    paciente_nome TEXT NOT NULL,
    paciente_cpf TEXT,
    procedimento_nome TEXT NOT NULL,
    procedimento_categoria TEXT,
    protocolo TEXT,
    prioridade TEXT,
    situacao_agendamento TEXT,
    data_agendada TEXT,
    solicitante_id TEXT NOT NULL,
    solicitante_nome TEXT NOT NULL,
    solicitante_setor TEXT,
    justificativa_solicitacao TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Aguardando Aprovação' CHECK (status IN ('Aguardando Aprovação', 'Aprovada', 'Rejeitada')),
    aprovador_id TEXT,
    aprovador_nome TEXT,
    decisao_justificativa TEXT,
    decidido_em TIMESTAMPTZ,
    criado_em TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Comentários explicativos
COMMENT ON TABLE public.consultas_solicitacoes_cancelamento IS 'Solicitações de cancelamento de agendamentos realizadas por usuários comuns para aprovação por gestores da regulação';
COMMENT ON COLUMN public.consultas_solicitacoes_cancelamento.status IS 'Status do fluxo: Aguardando Aprovação, Aprovada, Rejeitada';
COMMENT ON COLUMN public.consultas_solicitacoes_cancelamento.decisao_justificativa IS 'Justificativa do gestor ao rejeitar ou aprovar a solicitação';

-- Índices para buscas rápidas e verificações de concorrência
CREATE INDEX IF NOT EXISTS idx_solicitacoes_agendamento ON public.consultas_solicitacoes_cancelamento(agendamento_id);
CREATE INDEX IF NOT EXISTS idx_solicitacoes_status ON public.consultas_solicitacoes_cancelamento(status);
CREATE INDEX IF NOT EXISTS idx_solicitacoes_criado_em ON public.consultas_solicitacoes_cancelamento(criado_em);

-- Habilitar RLS
ALTER TABLE public.consultas_solicitacoes_cancelamento ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
DROP POLICY IF EXISTS "Todos autenticados podem consultar solicitações" ON public.consultas_solicitacoes_cancelamento;
CREATE POLICY "Todos autenticados podem consultar solicitações" ON public.consultas_solicitacoes_cancelamento
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Usuários autenticados podem inserir solicitações" ON public.consultas_solicitacoes_cancelamento;
CREATE POLICY "Usuários autenticados podem inserir solicitações" ON public.consultas_solicitacoes_cancelamento
    FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Usuários autenticados podem atualizar solicitações" ON public.consultas_solicitacoes_cancelamento;
CREATE POLICY "Usuários autenticados podem atualizar solicitações" ON public.consultas_solicitacoes_cancelamento
    FOR UPDATE TO authenticated USING (true);

-- Habilitar Realtime
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.consultas_solicitacoes_cancelamento;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_object THEN NULL;
END $$;

-- Recarregar schema no PostgREST
NOTIFY pgrst, 'reload schema';

