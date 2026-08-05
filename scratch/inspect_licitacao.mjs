import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const envFile = fs.readFileSync('.env', 'utf-8');
let supabaseUrl = '';
let supabaseKey = '';

for (const line of envFile.split('\n')) {
  if (line.startsWith('VITE_SUPABASE_URL=')) supabaseUrl = line.split('=')[1].trim();
  if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) supabaseKey = line.split('=')[1].trim();
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
  const { data, error } = await supabase.from('licitacao_processos').select('*').limit(1);
  if (error) {
    console.error('Error fetching licitacao_processos:', error);
  } else {
    console.log('Sample licitacao_processos row keys:', data.length > 0 ? Object.keys(data[0]) : 'No rows found');
    console.log('Sample licitacao_processos row:', data[0]);
  }
}

inspect();
