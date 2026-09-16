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

async function testNextSectorCounter() {
  const VEHICLE_ID = '33333333-3333-3333-3333-333333333333';
  const year = 2026;
  console.log("--- TESTANDO next_sector_counter ---");
  const { data, error } = await supabase.rpc('next_sector_counter', {
    p_sector_id: VEHICLE_ID,
    p_year: year
  });

  if (error) {
    console.error("Erro next_sector_counter:", error);
  } else {
    console.log("SUCESSO next_sector_counter! Próximo número:", data);
  }
}

testNextSectorCounter();
