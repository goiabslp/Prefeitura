-- Drop audit_logs table if it exists to force schema cache update and column creation
DROP TABLE IF EXISTS public.audit_logs CASCADE;

-- Create audit_logs table
CREATE TABLE public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    user_name TEXT NOT NULL,
    user_email TEXT,
    action_type TEXT NOT NULL, -- 'login', 'click', 'navigation', 'action', 'download', 'view'
    module TEXT,
    description TEXT NOT NULL,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to insert logs
CREATE POLICY "Allow authenticated inserts" ON public.audit_logs
    FOR INSERT TO authenticated WITH CHECK (true);

-- Policy: Allow admins to read logs
CREATE POLICY "Allow admins to read logs" ON public.audit_logs
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );
