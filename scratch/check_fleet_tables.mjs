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

async function checkFleetTables() {
  const tables = [
    { name: 'vehicle_schedules', select: 'id, protocol, vehicle_id, driver_id, requester_person_id, requester_id, destination, service_sector_id, purpose, departure_date_time, return_date_time, vehicle_location, status, created_at, authorized_by_name, passengers, patient_count, companion_count, cancellation_reason, cancelled_at, cancelled_by' },
    { name: 'vehicles', select: 'id, type, model, plate, brand, year, color, renavam, chassis, sector_id, responsible_person_id, document_url, document_name, vehicle_image_url, status, maintenance_status, fuel_types, created_at, request_manager_ids, max_kml, min_kml, current_km, oil_last_change, oil_next_change, oil_calculation_base, timing_belt_last_change, timing_belt_next_change, timing_belt_calculation_base, vehicle_category, available_for_scheduling, passenger_capacity' },
    { name: 'vehicle_oil_changes', select: 'id, vehicle_id, current_km, service_date, created_at' },
    { name: 'vehicle_timing_belt_changes', select: 'id, vehicle_id, current_km, service_date, created_at' },
    { name: 'vehicle_documents', select: 'id, vehicle_id, name, file_url, description, created_at' }
  ];

  for (const t of tables) {
    const { data, error } = await supabase.from(t.name).select(t.select).limit(1);
    if (error) {
      console.error(`[ERRO] ${t.name}:`, error.message);
    } else {
      console.log(`[OK] ${t.name} carregado com sucesso (${data.length} registros testados)`);
    }
  }
}

checkFleetTables();
