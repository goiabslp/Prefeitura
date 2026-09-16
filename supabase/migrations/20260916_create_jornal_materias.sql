-- Migration opcional para criar tabela física jornal_materias caso desejado
CREATE TABLE IF NOT EXISTS public.jornal_materias (
    id TEXT PRIMARY KEY,
    titulo TEXT NOT NULL,
    subtitulo TEXT,
    conteudo TEXT,
    categoria TEXT,
    data_publicacao TIMESTAMPTZ DEFAULT now(),
    data_evento DATE,
    hora_evento TIME,
    imagem_url TEXT,
    imagem_posicao TEXT,
    autor TEXT,
    destaque_frase TEXT,
    evento_id TEXT,
    tipo_evento TEXT,
    setor TEXT,
    oculta BOOLEAN DEFAULT false,
    destaque BOOLEAN DEFAULT false,
    aprovada BOOLEAN DEFAULT true,
    status TEXT DEFAULT 'publicada',
    curtidas INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Ativar RLS
ALTER TABLE public.jornal_materias ENABLE ROW LEVEL SECURITY;

-- Política de leitura pública
CREATE POLICY "Permitir leitura pública de matérias" 
ON public.jornal_materias FOR SELECT 
USING (true);

-- Política de inserção e atualização autenticada
CREATE POLICY "Permitir inserção e atualização autenticada" 
ON public.jornal_materias FOR ALL 
USING (auth.role() = 'authenticated' OR auth.role() = 'anon');
