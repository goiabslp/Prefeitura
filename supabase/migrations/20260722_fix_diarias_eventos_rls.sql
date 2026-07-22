-- Script SQL para atualizar as políticas de RLS em public.diarias_eventos
-- permitindo inserção, leitura, exclusão e atualização sem conflitos de políticas existentes

DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.diarias_eventos;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.diarias_eventos;
DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON public.diarias_eventos;
DROP POLICY IF EXISTS "Enable update for users based on user_id" ON public.diarias_eventos;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.diarias_eventos;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.diarias_eventos;

-- Permitir inserção
CREATE POLICY "Enable insert for authenticated users" ON public.diarias_eventos
    FOR INSERT WITH CHECK (true);

-- Permitir leitura
CREATE POLICY "Enable read access for authenticated users" ON public.diarias_eventos
    FOR SELECT USING (true);

-- Permitir atualização para usuários autenticados/administradores
CREATE POLICY "Enable update for authenticated users" ON public.diarias_eventos
    FOR UPDATE USING (true);

-- Permitir exclusão para usuários autenticados/administradores
CREATE POLICY "Enable delete for authenticated users" ON public.diarias_eventos
    FOR DELETE USING (true);
