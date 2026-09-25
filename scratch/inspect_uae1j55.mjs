import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

let env = fs.readFileSync('.env', 'utf8');
let url = '', key = '';
env.split('\n').forEach(line => {
  if (line.startsWith('VITE_SUPABASE_URL=')) url = line.replace('VITE_SUPABASE_URL=', '').trim();
  if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) key = line.replace('VITE_SUPABASE_ANON_KEY=', '').trim();
});
const supabase = createClient(url, key);

async function inspectVehicles() {
  console.log('=== BUSCANDO VEÍCULOS COM PLACA UAE1J55 ===');
  const { data: vehicles, error: vErr } = await supabase
    .from('vehicles')
    .select('*')
    .ilike('plate', '%UAE1J55%');

  if (vErr) {
    console.error('Erro ao buscar veículos:', vErr);
    return;
  }

  console.log(`Encontrados ${vehicles?.length || 0} veículos com a placa UAE1J55:`);
  console.log(JSON.stringify(vehicles, null, 2));

  if (!vehicles || vehicles.length === 0) {
    // Buscar todos os veículos para ver as placas
    const { data: allV } = await supabase.from('vehicles').select('id, plate, model, brand');
    console.log('Todos os veículos cadastrados:');
    console.log(allV);
    return;
  }

  const vehicleIds = vehicles.map(v => v.id);
  console.log('\nIDs dos veículos:', vehicleIds);

  // Tabelas conhecidas que podem referenciar vehicle_id
  const tablesToCheck = [
    { table: 'vehicle_schedules', col: 'vehicle_id' },
    { table: 'vehicle_schedules', col: 'vehicleId' },
    { table: 'trips', col: 'vehicle_id' },
    { table: 'fleet_maintenances', col: 'vehicle_id' },
    { table: 'fleet_parts', col: 'vehicle_id' },
    { table: 'fleet_purchases', col: 'vehicle_id' },
    { table: 'fleet_oil_changes', col: 'vehicle_id' },
    { table: 'vehicle_checklists', col: 'vehicle_id' },
    { table: 'fleet_fuel_records', col: 'vehicle_id' },
    { table: 'fleet_occurrences', col: 'vehicle_id' },
    { table: 'fleet_fines', col: 'vehicle_id' },
    { table: 'fleet_tires', col: 'vehicle_id' },
    { table: 'tires', col: 'vehicle_id' },
    { table: 'passengers', col: 'vehicle_id' },
    { table: 'patient_schedules', col: 'vehicle_id' },
    { table: 'agendamentos_saude', col: 'veiculo_id' },
    { table: 'regulacao_pacientes', col: 'veiculo_id' }
  ];

  for (const { table, col } of tablesToCheck) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .in(col, vehicleIds);

      if (!error && data && data.length > 0) {
        console.log(`\n>>> TABELA [${table}] (${col}) TEM ${data.length} REGISTROS VINCULADOS:`);
        console.log(JSON.stringify(data, null, 2));
      }
    } catch (e) {
      // Tabela pode não existir
    }
  }
}

inspectVehicles();
