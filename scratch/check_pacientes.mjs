import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lntphzphyqnscdxyauzj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxudHBoenBoeXFuc2NkeHlhdXpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4NzkzMzksImV4cCI6MjA4MjQ1NTMzOX0.3yCGZx-Wjoqv-FNHaEnlxdFpjjnSl9ynGZzG70yD-Fw';

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { count: totalPacientes } = await supabase.from('consultas_pacientes').select('*', { count: 'exact', head: true });
  console.log('Total pacientes:', totalPacientes);

  const { data: pacs } = await supabase.from('consultas_pacientes').select('id, name, cpf, neighborhood, agente_saude').limit(5);
  console.log('Pacientes amostra:', pacs);
}

test();
