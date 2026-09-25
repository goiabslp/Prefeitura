import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

let env = fs.readFileSync('.env', 'utf8');
let url = '', key = '';
env.split('\n').forEach(line => {
  if (line.startsWith('VITE_SUPABASE_URL=')) url = line.replace('VITE_SUPABASE_URL=', '').trim();
  if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) key = line.replace('VITE_SUPABASE_ANON_KEY=', '').trim();
});
const supabase = createClient(url, key);

const id1 = '14bb9f79-a282-490a-b210-1c0c2584026f'; // Mais recente (detalhes mais ricos: MASTER RAY L3PAS, cap 16)
const id2 = '7e1a30d6-bc38-4302-8399-19f052f5697d'; // Mais antigo (com 48 agendamentos)

async function checkAllPossibleTables() {
  const tables = [
    'vehicle_schedules',
    'trips',
    'fleet_maintenances',
    'fleet_parts',
    'fleet_purchases',
    'fleet_oil_changes',
    'fleet_fuel_records',
    'fleet_occurrences',
    'fleet_fines',
    'fleet_tires',
    'vehicle_checklists',
    'maintenance_orders',
    'vehicle_logs',
    'vehicle_history',
    'notifications'
  ];

  console.log('--- VERIFICANDO TODAS AS TABELAS ---');
  for (const t of tables) {
    try {
      const { data: d1, error: e1 } = await supabase.from(t).select('*').eq('vehicle_id', id1);
      const { data: d2, error: e2 } = await supabase.from(t).select('*').eq('vehicle_id', id2);
      if (d1?.length || d2?.length) {
        console.log(`Tabela ${t}: ID1 (${id1}) tem ${d1?.length || 0} registros; ID2 (${id2}) tem ${d2?.length || 0} registros`);
      }
    } catch (e) {
      // Ignora erro de coluna não existir
    }
  }
}

checkAllPossibleTables();
