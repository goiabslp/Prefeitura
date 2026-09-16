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

async function testOldAndNew() {
  const OLD_COLUMNS = 'id, protocol, vehicle_id, driver_id, destination, departure_date, return_date, status, reason, created_at, vehicle_location, authorized_by_name, passengers, patient_count, companion_count, cancellation_reason, cancelled_at, cancelled_by';
  
  console.log("--- TESTANDO QUERY ANTIGA DE SCHEDULE_COLUMNS ---");
  const { data: oldData, error: oldError } = await supabase
    .from('vehicle_schedules')
    .select(OLD_COLUMNS)
    .limit(5);

  if (oldError) {
    console.log("Erro confirmado na query antiga:", oldError.message);
  } else {
    console.log("Sucesso antigo?", oldData?.length);
  }

  const NEW_COLUMNS = 'id, protocol, vehicle_id, driver_id, requester_person_id, requester_id, destination, service_sector_id, purpose, departure_date_time, return_date_time, vehicle_location, status, created_at, authorized_by_name, passengers, patient_count, companion_count, cancellation_reason, cancelled_at, cancelled_by';

  console.log("--- TESTANDO QUERY NOVA DE SCHEDULE_COLUMNS ---");
  const { data: newData, error: newError } = await supabase
    .from('vehicle_schedules')
    .select(NEW_COLUMNS)
    .limit(5);

  if (newError) {
    console.error("Erro na query nova:", newError);
  } else {
    console.log("Sucesso na query nova! Linhas retornadas:", newData.length);
    console.log("Primeira linha:", newData[0]);
  }
}

testOldAndNew();
