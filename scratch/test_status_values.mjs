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

async function testStatus() {
  const { data: list } = await supabase.from('consultas_procedimentos').select('id, status').limit(1);
  if (!list || list.length === 0) return;
  const id = list[0].id;
  const originalStatus = list[0].status;

  const res1 = await supabase.from('consultas_procedimentos').update({ status: 'Inativo' }).eq('id', id).select();
  console.log("Update to Inativo:", res1.error ? res1.error : "OK");

  const res2 = await supabase.from('consultas_procedimentos').update({ status: 'Suspenso' }).eq('id', id).select();
  console.log("Update to Suspenso:", res2.error ? res2.error : "OK");

  // restore
  await supabase.from('consultas_procedimentos').update({ status: originalStatus }).eq('id', id);
}

testStatus();
