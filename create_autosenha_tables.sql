-- ==============================================================================
-- MÓDULO AUTOSENHA - PREFEITURA INTEGRADA SÃO JOSÉ DO GOIABAL - MG
-- Tabelas, Índices, RLS e Triggers para Gestão de Senhas, Filas e Atendimentos
-- ==============================================================================

-- 1. TABELA DE UNIDADES DE SAÚDE
CREATE TABLE IF NOT EXISTS public.autosenha_unidades (
    id TEXT PRIMARY KEY, -- 'psf1', 'psf2', 'upa'
    nome TEXT NOT NULL,
    sigla TEXT NOT NULL,
    tipo TEXT NOT NULL, -- 'PSF' ou 'UPA'
    ativo BOOLEAN NOT NULL DEFAULT true,
    horario_inicio TIME NOT NULL DEFAULT '07:00:00',
    horario_fim TIME NOT NULL DEFAULT '17:00:00',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Seed das 3 unidades obrigatórias
INSERT INTO public.autosenha_unidades (id, nome, sigla, tipo)
VALUES
    ('psf1', 'PSF 1 — Dr. José Maria de Carvalho', 'PSF 1', 'PSF'),
    ('psf2', 'PSF 2 — Maria das Graças Silva', 'PSF 2', 'PSF'),
    ('upa', 'UPA — Unidade de Pronto Atendimento', 'UPA', 'UPA')
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    sigla = EXCLUDED.sigla,
    tipo = EXCLUDED.tipo;

-- 2. TABELA DE CONFIGURAÇÕES DE PRIORIDADE E LIMITES POR UNIDADE
CREATE TABLE IF NOT EXISTS public.autosenha_configuracoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unidade_id TEXT NOT NULL REFERENCES public.autosenha_unidades(id) ON DELETE CASCADE,
    regra_alternancia TEXT NOT NULL DEFAULT '2_P_1_N', -- '1_P_1_N', '2_P_1_N', '3_P_1_N', 'APENAS_PRIORIDADE'
    proporcao_prioridade INT NOT NULL DEFAULT 2,
    proporcao_normal INT NOT NULL DEFAULT 1,
    contador_prioridade_atual INT NOT NULL DEFAULT 0,
    contador_normal_atual INT NOT NULL DEFAULT 0,
    limite_espera_atencao_min INT NOT NULL DEFAULT 30, -- minutos para status 'Atenção'
    limite_espera_critico_min INT NOT NULL DEFAULT 60, -- minutos para status 'Alta Demanda'
    limite_fila_atencao_qtd INT NOT NULL DEFAULT 10,
    limite_fila_critico_qtd INT NOT NULL DEFAULT 20,
    som_habilitado BOOLEAN NOT NULL DEFAULT true,
    ocultar_sobrenome_tv BOOLEAN NOT NULL DEFAULT false,
    mensagem_rodape_tv TEXT DEFAULT 'Prefeitura de São José do Goiabal — Cuidando da nossa gente',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_autosenha_config_unidade UNIQUE (unidade_id)
);

-- Seed de configurações padrão
INSERT INTO public.autosenha_configuracoes (unidade_id, regra_alternancia, proporcao_prioridade, proporcao_normal, limite_espera_atencao_min, limite_espera_critico_min)
VALUES
    ('psf1', '2_P_1_N', 2, 1, 30, 60),
    ('psf2', '2_P_1_N', 2, 1, 30, 60),
    ('upa', '2_P_1_N', 2, 1, 20, 45)
ON CONFLICT (unidade_id) DO NOTHING;

-- 3. TABELA PRINCIPAL DE SENHAS
CREATE TABLE IF NOT EXISTS public.autosenha_senhas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unidade_id TEXT NOT NULL REFERENCES public.autosenha_unidades(id) ON DELETE RESTRICT,
    numero TEXT NOT NULL, -- Ex: 'N001', 'P001', 'E001'
    numero_sequencial INT NOT NULL, -- 1, 2, 3...
    data_operacional DATE NOT NULL DEFAULT CURRENT_DATE, -- Reinicia diário no fuso Brasil
    cidadao_nome TEXT NOT NULL,
    prioridade_tipo TEXT NOT NULL, -- 'NORMAL', 'PRIORITARIO', 'ESPECIAL'
    prioridade_categoria TEXT, -- 'Idoso (60-79)', 'Idoso 80+', 'Gestante', 'Lactante', 'PCD', 'Autista (TEA)', 'Criança de Colo', 'Outro'
    status TEXT NOT NULL DEFAULT 'AGUARDANDO', -- 'AGUARDANDO', 'CHAMANDO', 'EM_ATENDIMENTO', 'CONCLUIDO', 'NAO_COMPARECEU', 'CANCELADO'
    
    -- Operadores e Guichê
    guiche TEXT DEFAULT 'Recepção',
    atendente_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    atendente_nome TEXT,
    
    -- Timestamps Oficiais Rigorosos
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    first_called_at TIMESTAMPTZ,
    last_called_at TIMESTAMPTZ,
    call_count INT NOT NULL DEFAULT 0,
    service_started_at TIMESTAMPTZ,
    service_finished_at TIMESTAMPTZ,
    
    -- Métricas em segundos persistidas ao finalizar
    wait_time_first_call_seconds INT,
    wait_time_total_seconds INT,
    service_duration_seconds INT,
    
    -- Motivo de cancelamento ou não comparecimento
    motivo_encerramento TEXT,
    
    CONSTRAINT uq_unidade_data_numero UNIQUE (unidade_id, data_operacional, numero)
);

-- Índices de Alta Performance
CREATE INDEX IF NOT EXISTS idx_autosenha_unidade_status ON public.autosenha_senhas(unidade_id, status);
CREATE INDEX IF NOT EXISTS idx_autosenha_data_operacional ON public.autosenha_senhas(data_operacional);
CREATE INDEX IF NOT EXISTS idx_autosenha_prioridade ON public.autosenha_senhas(prioridade_tipo);
CREATE INDEX IF NOT EXISTS idx_autosenha_created_at ON public.autosenha_senhas(created_at);

-- 4. TABELA DE HISTÓRICO DE CHAMADAS E RECHAMADAS
CREATE TABLE IF NOT EXISTS public.autosenha_chamadas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    senha_id UUID NOT NULL REFERENCES public.autosenha_senhas(id) ON DELETE CASCADE,
    unidade_id TEXT NOT NULL REFERENCES public.autosenha_unidades(id) ON DELETE RESTRICT,
    numero_chamada INT NOT NULL DEFAULT 1,
    tipo_evento TEXT NOT NULL, -- 'CHAMADA_INICIAL', 'RECHAMADA'
    guiche TEXT NOT NULL DEFAULT 'Recepção',
    operador_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    operador_nome TEXT NOT NULL,
    timestamp_chamada TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_chamadas_senha_id ON public.autosenha_chamadas(senha_id);
CREATE INDEX IF NOT EXISTS idx_chamadas_unidade_ts ON public.autosenha_chamadas(unidade_id, timestamp_chamada DESC);

-- 5. TABELA DE AUDITORIA E MOVIMENTAÇÕES DO AUTOSENHA
CREATE TABLE IF NOT EXISTS public.autosenha_auditoria (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unidade_id TEXT NOT NULL REFERENCES public.autosenha_unidades(id) ON DELETE RESTRICT,
    senha_id UUID REFERENCES public.autosenha_senhas(id) ON DELETE SET NULL,
    senha_numero TEXT,
    acao TEXT NOT NULL, -- 'EMISSAO', 'CHAMADA', 'RECHAMADA', 'INICIO_ATENDIMENTO', 'CONCLUSAO', 'NAO_COMPARECEU', 'CANCELAMENTO', 'CONFIG_ALTERADA', 'AVALIACAO_URGENTE_UPA'
    descricao TEXT NOT NULL,
    detalhes JSONB DEFAULT '{}'::jsonb,
    usuario_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    usuario_nome TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_auditoria_unidade_created ON public.autosenha_auditoria(unidade_id, created_at DESC);

-- 6. TABELA PARTICULARIDADE UPA — SOLICITAÇÕES DE AVALIAÇÃO IMEDIATA (TRIAGEM CLÍNICA)
CREATE TABLE IF NOT EXISTS public.autosenha_avaliacoes_urgentes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unidade_id TEXT NOT NULL DEFAULT 'upa' REFERENCES public.autosenha_unidades(id) ON DELETE RESTRICT,
    senha_id UUID REFERENCES public.autosenha_senhas(id) ON DELETE SET NULL,
    senha_numero TEXT,
    cidadao_nome TEXT NOT NULL,
    motivo_queixa TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDENTE', -- 'PENDENTE', 'ENCAMINHADO_PRESENCIAL', 'ATENDIDO'
    solicitante_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    solicitante_nome TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    atendido_em TIMESTAMPTZ,
    observacoes_desfecho TEXT
);

-- ==============================================================================
-- RLS (ROW LEVEL SECURITY)
-- ==============================================================================
ALTER TABLE public.autosenha_unidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.autosenha_configuracoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.autosenha_senhas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.autosenha_chamadas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.autosenha_auditoria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.autosenha_avaliacoes_urgentes ENABLE ROW LEVEL SECURITY;

-- Políticas de Leitura e Escrita
-- Painéis de TV públicos precisam ler as senhas e configurações da unidade
CREATE POLICY "Leitura pública e autenticada de unidades" ON public.autosenha_unidades FOR SELECT USING (true);
CREATE POLICY "Leitura pública e autenticada de configuracoes" ON public.autosenha_configuracoes FOR SELECT USING (true);
CREATE POLICY "Leitura pública e autenticada de senhas" ON public.autosenha_senhas FOR SELECT USING (true);
CREATE POLICY "Leitura pública e autenticada de chamadas" ON public.autosenha_chamadas FOR SELECT USING (true);
CREATE POLICY "Leitura pública e autenticada de auditoria" ON public.autosenha_auditoria FOR SELECT USING (true);
CREATE POLICY "Leitura pública e autenticada de avaliacoes" ON public.autosenha_avaliacoes_urgentes FOR SELECT USING (true);

-- Inserção e Atualização para usuários autenticados ou anon autorizados
CREATE POLICY "Operações autenticadas em senhas" ON public.autosenha_senhas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Operações autenticadas em chamadas" ON public.autosenha_chamadas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Operações autenticadas em configuracoes" ON public.autosenha_configuracoes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Operações autenticadas em auditoria" ON public.autosenha_auditoria FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Operações autenticadas em avaliacoes" ON public.autosenha_avaliacoes_urgentes FOR ALL USING (true) WITH CHECK (true);

-- Habilitar Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.autosenha_senhas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.autosenha_chamadas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.autosenha_configuracoes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.autosenha_avaliacoes_urgentes;
