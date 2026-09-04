import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lntphzphyqnscdxyauzj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxudHBoenBoeXFuc2NkeHlhdXpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4NzkzMzksImV4cCI6MjA4MjQ1NTMzOX0.3yCGZx-Wjoqv-FNHaEnlxdFpjjnSl9ynGZzG70yD-Fw';

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data: ags, error: e1 } = await supabase.from('consultas_agendamentos').select('id, status, priority, appointment_date, solicitation_date, created_at, procedimento_id, patient_id').limit(5);
  console.log('Agendamentos amostra:', ags?.length, JSON.stringify(ags, null, 2));
  
  const { count: totalAgs } = await supabase.from('consultas_agendamentos').select('*', { count: 'exact', head: true });
  console.log('Total agendamentos:', totalAgs);

  const { data: statusCounts } = await supabase.from('consultas_agendamentos').select('status, priority');
  const countByStatus = {};
  const countByPriority = {};
  (statusCounts || []).forEach(s => {
    countByStatus[s.status] = (countByStatus[s.status] || 0) + 1;
    countByPriority[s.priority] = (countByPriority[s.priority] || 0) + 1;
  });
  console.log('Status:', countByStatus);
  console.log('Prioridade:', countByPriority);
  
  const { data: procs } = await supabase.from('consultas_procedimentos').select('id, name, type, available_quantity, total_quantity');
  console.log('Total procedimentos:', procs?.length);

  const { count: totalVagas } = await supabase.from('consultas_vagas').select('*', { count: 'exact', head: true });
  console.log('Total vagas cadastradas:', totalVagas);
}

test();
