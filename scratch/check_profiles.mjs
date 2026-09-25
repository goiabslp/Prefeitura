import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

let env = fs.readFileSync('.env', 'utf8');
let url = '', key = '';
env.split('\n').forEach(line => {
  if (line.startsWith('VITE_SUPABASE_URL=')) url = line.replace('VITE_SUPABASE_URL=', '').trim();
  if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) key = line.replace('VITE_SUPABASE_ANON_KEY=', '').trim();
});
const supabase = createClient(url, key);

async function check() {
  const { data, error } = await supabase.from('profiles').select('*').limit(3);
  console.log('Profiles data length:', data?.length, 'error:', error);
  if (data && data[0]) {
    console.log('Sample profile columns:', Object.keys(data[0]));
    console.log('Sample profile row:', data[0]);
  }
}
check();
