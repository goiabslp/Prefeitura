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

async function findDuplicates() {
  const { data, error } = await supabase.from('operation_codes').select('*');
  if (error) {
    console.error(error);
    return;
  }
  
  const map = new Map();
  const duplicates = [];
  for (const row of data) {
    const key = `${row.module}:::${row.record_id}`;
    if (!map.has(key)) {
      map.set(key, [row]);
    } else {
      map.get(key).push(row);
    }
  }

  for (const [key, rows] of map.entries()) {
    if (rows.length > 1) {
      duplicates.push({ key, count: rows.length, rows });
    }
  }

  console.log(`Total rows: ${data.length}, Duplicated keys: ${duplicates.length}`);
  console.log("Duplicate samples:", JSON.stringify(duplicates.slice(0, 10), null, 2));
}

findDuplicates();
