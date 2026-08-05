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

async function testUpdateLogic(id, updates) {
  try {
    const { data, error } = await supabase
      .from('licitacao_processos')
      .update(updates)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) {
      if (error.code === 'PGRST204' && (error.message?.includes('checkin_finalizado') || JSON.stringify(error).includes('checkin_finalizado'))) {
        console.warn("Column 'checkin_finalizado' not found in database. Retrying update without checkin_finalizado...");
        const sanitized = { ...updates };
        delete sanitized.checkin_finalizado;

        const { data: retryData, error: retryError } = await supabase
          .from('licitacao_processos')
          .update(sanitized)
          .eq('id', id)
          .select()
          .maybeSingle();

        if (retryError) throw retryError;
        return retryData;
      }
      throw error;
    }
    return data;
  } catch (err) {
    console.error('Update failed:', err);
    throw err;
  }
}

async function run() {
  const { data: list } = await supabase.from('licitacao_processos').select('id').limit(1);
  if (!list || list.length === 0) return;
  const id = list[0].id;

  console.log('Testing fallback update logic with fase="finalizado" and checkin_finalizado...');
  const res = await testUpdateLogic(id, { fase: 'finalizado', checkin_finalizado: { assinados: true } });
  console.log('Update completed successfully. Returned data:', res);
}

run();
