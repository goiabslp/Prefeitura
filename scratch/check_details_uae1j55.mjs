import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

let env = fs.readFileSync('.env', 'utf8');
let url = '', key = '';
env.split('\n').forEach(line => {
  if (line.startsWith('VITE_SUPABASE_URL=')) url = line.replace('VITE_SUPABASE_URL=', '').trim();
  if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) key = line.replace('VITE_SUPABASE_ANON_KEY=', '').trim();
});
const supabase = createClient(url, key);

async function checkDetails() {
  const { data: vehicles } = await supabase
    .from('vehicles')
    .select('*')
    .ilike('plate', '%UAE1J55%');

  console.log('VEICULOS ENCONTRADOS:', vehicles.length);
  vehicles.forEach((v, i) => {
    console.log(`\n--- VEICULO ${i + 1} ---`);
    console.log(`ID: ${v.id}`);
    console.log(`Model: ${v.model}`);
    console.log(`Brand: ${v.brand}`);
    console.log(`Plate: ${v.plate}`);
    console.log(`Year: ${v.year}`);
    console.log(`Color: ${v.color}`);
    console.log(`Type: ${v.type}`);
    console.log(`VehicleCategory: ${v.vehicle_category}`);
    console.log(`PassengerCapacity: ${v.passenger_capacity}`);
    console.log(`CurrentKm: ${v.current_km}`);
    console.log(`Renavam: ${v.renavam}`);
    console.log(`Chassis: ${v.chassis}`);
    console.log(`SectorId: ${v.sector_id}`);
    console.log(`ResponsiblePersonId: ${v.responsible_person_id}`);
    console.log(`Status: ${v.status}`);
    console.log(`MaintenanceStatus: ${v.maintenance_status}`);
    console.log(`ImageUrl: ${v.vehicle_image_url}`);
    console.log(`DocumentUrl: ${v.document_url}`);
    console.log(`CreatedAt: ${v.created_at}`);
  });

  const ids = vehicles.map(v => v.id);

  // Verificar agendamentos em vehicle_schedules para cada ID
  for (const id of ids) {
    const { data: scheds } = await supabase.from('vehicle_schedules').select('id, protocol, status, departure_date_time, purpose').eq('vehicle_id', id);
    console.log(`\nAgendamentos para Veículo ID [${id}]:`, scheds?.length || 0);
    if (scheds && scheds.length > 0) {
      console.log(scheds);
    }
  }

  // Verificar outras tabelas
  const otherTables = [
    'fleet_maintenances',
    'fleet_parts',
    'fleet_purchases',
    'fleet_oil_changes',
    'fleet_fuel_records',
    'fleet_occurrences',
    'fleet_fines',
    'fleet_tires',
    'vehicle_checklists'
  ];

  for (const t of otherTables) {
    for (const id of ids) {
      try {
        const { data, error } = await supabase.from(t).select('id').eq('vehicle_id', id);
        if (!error && data && data.length > 0) {
          console.log(`Tabela [${t}] tem ${data.length} registros para o ID [${id}]`);
        }
      } catch (e) {}
    }
  }
}

checkDetails();
