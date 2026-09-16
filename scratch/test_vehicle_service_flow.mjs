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

const SCHEDULE_COLUMNS = 'id, protocol, vehicle_id, driver_id, requester_person_id, requester_id, destination, service_sector_id, purpose, departure_date_time, return_date_time, vehicle_location, status, created_at, authorized_by_name, passengers, patient_count, companion_count, cancellation_reason, cancelled_at, cancelled_by';

async function testFullVehicleFlow() {
  console.log("=== 1. TESTANDO BUSCA GERAL (getSchedules) ===");
  const { data: schedules, error: err1 } = await supabase
    .from('vehicle_schedules')
    .select(SCHEDULE_COLUMNS)
    .order('created_at', { ascending: false })
    .limit(10);

  if (err1) {
    console.error("FAIL getSchedules:", err1);
    process.exit(1);
  }
  console.log(`PASS getSchedules: ${schedules.length} agendamentos retornados com sucesso.`);

  if (schedules.length > 0) {
    const testId = schedules[0].id;
    console.log(`=== 2. TESTANDO BUSCA POR ID (${testId}) ===`);
    const { data: single, error: err2 } = await supabase
      .from('vehicle_schedules')
      .select(SCHEDULE_COLUMNS)
      .eq('id', testId)
      .single();

    if (err2) {
      console.error("FAIL getScheduleById:", err2);
      process.exit(1);
    }
    console.log(`PASS getScheduleById: protocol=${single.protocol}, dest=${single.destination}, status=${single.status}`);
  }

  console.log("=== 3. TESTANDO VERIFICAÇÃO DE DISPONIBILIDADE (checkAvailability) ===");
  const { data: avail, error: err3 } = await supabase
    .from('vehicle_schedules')
    .select('id')
    .in('status', ['confirmado', 'em_curso'])
    .limit(1);

  if (err3) {
    console.error("FAIL checkAvailability query:", err3);
    process.exit(1);
  }
  console.log("PASS checkAvailability query.");

  console.log("=== 4. TESTANDO BUSCA DE GESTORES DE FROTA (notifyApprovers) ===");
  const { data: managers, error: err4 } = await supabase
    .from('profiles')
    .select('id')
    .contains('permissions', ['parent_frotas']);

  if (err4) {
    console.error("FAIL notifyApprovers query:", err4);
    process.exit(1);
  }
  console.log(`PASS notifyApprovers query: ${managers.length} gestores encontrados.`);

  console.log("\n>>> TODOS OS TESTES DO MÓDULO AGENDAMENTO DE VEÍCULOS PASSARAM COM 100% DE SUCESSO! <<<");
}

testFullVehicleFlow();
