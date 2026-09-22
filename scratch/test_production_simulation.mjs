import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lntphzphyqnscdxyauzj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxudHBoenBoeXFuc2NkeHlhdXpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4NzkzMzksImV4cCI6MjA4MjQ1NTMzOX0.3yCGZx-Wjoqv-FNHaEnlxdFpjjnSl9ynGZzG70yD-Fw';

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectAll() {
  const { count: c1, error: e1 } = await supabase.from('consultas_agendamentos').select('*', { count: 'exact', head: true });
  console.log('consultas_agendamentos count:', c1, e1 ? e1.message : 'OK');

  const { count: c2, error: e2 } = await supabase.from('consultas_pacientes').select('*', { count: 'exact', head: true });
  console.log('consultas_pacientes count:', c2, e2 ? e2.message : 'OK');

  const { count: c3, error: e3 } = await supabase.from('consultas_procedimentos').select('*', { count: 'exact', head: true });
  console.log('consultas_procedimentos count:', c3, e3 ? e3.message : 'OK');

  const { data: orgData } = await supabase
    .from('organization_settings')
    .select('*')
    .eq('id', 'global_config')
    .maybeSingle();
  console.log('org settings exists:', !!orgData);
}

inspectAll().catch(console.error);
