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

async function cleanAllDuplicates() {
  let allRows = [];
  let from = 0;
  const pageSize = 1000;
  
  while (true) {
    const { data, error } = await supabase
      .from('operation_codes')
      .select('*')
      .order('created_at', { ascending: false })
      .range(from, from + pageSize - 1);

    if (error) {
      console.error('Error fetching range:', error);
      break;
    }
    if (!data || data.length === 0) break;
    allRows.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  console.log(`Total rows fetched: ${allRows.length}`);

  const seen = new Set();
  const toDelete = [];

  for (const row of allRows) {
    const key = `${row.module}:::${row.record_id}`;
    if (seen.has(key)) {
      toDelete.push(row.code);
    } else {
      seen.add(key);
    }
  }

  console.log(`Found ${toDelete.length} duplicates to delete across all pages.`);

  if (toDelete.length > 0) {
    for (let i = 0; i < toDelete.length; i += 50) {
      const batch = toDelete.slice(i, i + 50);
      const { error: delError } = await supabase.from('operation_codes').delete().in('code', batch);
      if (delError) {
        console.error('Delete batch error:', delError);
      }
    }
    console.log('Cleanup finished!');
  }
}

cleanAllDuplicates();
