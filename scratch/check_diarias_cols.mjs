import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('.env', 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const [k, ...v] = line.split('=');
  if (k && v.length) {
    env[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g, '');
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function checkDiariasColumns() {
  const { data, error } = await supabase.from('diarias_eventos').select('*').limit(1);
  if (error) {
    console.error("Erro:", error);
  } else {
    console.log("Colunas reais de diarias_eventos:", Object.keys(data[0]));
    console.log("Tem valor?", 'valor' in data[0]);
    console.log("Tem ultimo_checkpoint?", 'ultimo_checkpoint' in data[0]);
  }
}

checkDiariasColumns();
