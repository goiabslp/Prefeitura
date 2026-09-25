import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

let env = fs.readFileSync('.env', 'utf8');
let url = '', key = '';
env.split('\n').forEach(line => {
  if (line.startsWith('VITE_SUPABASE_URL=')) url = line.replace('VITE_SUPABASE_URL=', '').trim();
  if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) key = line.replace('VITE_SUPABASE_ANON_KEY=', '').trim();
});
const supabase = createClient(url, key);

async function checkFKs() {
  const id1 = '14bb9f79-a282-490a-b210-1c0c2584026f';
  const id2 = '7e1a30d6-bc38-4302-8399-19f052f5697d';

  // Buscar todas as tabelas e dados
  const { data: v1 } = await supabase.from('vehicles').select('*').eq('id', id1).single();
  const { data: v2 } = await supabase.from('vehicles').select('*').eq('id', id2).single();

  console.log('Dados Veículo 1 (Mais novo):', v1);
  console.log('\nDados Veículo 2 (Com agendamentos):', v2);
}

checkFKs();
