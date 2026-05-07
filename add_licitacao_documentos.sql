CREATE TABLE IF NOT EXISTS licitacao_documentos (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    processo_id UUID REFERENCES licitacao_processos(id) ON DELETE CASCADE,
    nome_documento TEXT NOT NULL,
    url TEXT NOT NULL,
    criado_por UUID REFERENCES auth.users(id),
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE licitacao_documentos ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso
CREATE POLICY "Permitir leitura de documentos da licitacao para todos autenticados" ON licitacao_documentos FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Permitir insercao de documentos da licitacao para autenticados" ON licitacao_documentos FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Permitir exclusao de documentos da licitacao para autenticados" ON licitacao_documentos FOR DELETE USING (auth.role() = 'authenticated');
