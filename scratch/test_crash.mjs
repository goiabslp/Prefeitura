import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import { parseISO } from 'date-fns';

const envContent = fs.readFileSync('.env', 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const [k, ...v] = line.split('=');
  if (k && v.length) env[k.trim()] = v.join('=').trim().replace(/^['"]|['"]$/g, '');
});
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function testFleet() {
  const { data: vehicles } = await supabase.from('vehicles').select('*');
  const { data: schedules } = await supabase.from('vehicle_schedules').select('*');
  const s = schedules.find(x => x.protocol === 'OS-2026830569949');

  const selectedVehicleId = '';
  const vehicleInput = 'FIAT ARGO • TXY2G82';
  const fineDate = '2026-10-14';
  const fineTime = '09:00';

  const cleanPlate = (p) => (p || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

  const rawInput = vehicleInput.trim();
  const matchedVehicle = vehicles.find(v => 
    (selectedVehicleId && v.id === selectedVehicleId) ||
    (rawInput && (
      cleanPlate(v.plate) === cleanPlate(rawInput) ||
      (cleanPlate(rawInput).length >= 5 && cleanPlate(v.plate).includes(cleanPlate(rawInput))) ||
      `${v.brand || ''} ${v.model} • ${v.plate}`.toLowerCase() === rawInput.toLowerCase()
    ))
  );

  const effectiveVehicleId = matchedVehicle?.id || selectedVehicleId;
  const targetPlateClean = cleanPlate(matchedVehicle?.plate || rawInput);

  const scheduleVehicle = vehicles.find(v => v.id === s.vehicle_id);
  const isVehicleDirectMatch = Boolean(effectiveVehicleId && s.vehicle_id === effectiveVehicleId);
  const schedulePlateClean = cleanPlate(scheduleVehicle?.plate);

  const isPlateMatch = Boolean(
    targetPlateClean && 
    schedulePlateClean && 
    (schedulePlateClean === targetPlateClean || schedulePlateClean.includes(targetPlateClean) || targetPlateClean.includes(schedulePlateClean))
  );

  const [hours, minutes] = fineTime.split(':').map(Number);
  const infractionTarget = new Date(`${fineDate}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`);
  const infractionTimestamp = infractionTarget.getTime();

  const depDate = parseISO(s.departure_date_time);
  const retDate = parseISO(s.return_date_time);

  const depTime = depDate.getTime();
  const retTime = retDate.getTime();

  console.log({
    matchedVehicle: Boolean(matchedVehicle),
    isVehicleDirectMatch,
    isPlateMatch,
    targetPlateClean,
    schedulePlateClean,
    infractionTimestamp,
    depTime,
    retTime,
    between: infractionTimestamp >= depTime && infractionTimestamp <= retTime
  });

  try {
    const obj = {
      id: `agendamento_${s.id}`,
      vehicleModel: targetVehicle ? `${targetVehicle.brand} ${targetVehicle.model}` : 'Veículo da Frota',
    };
    console.log('Success push:', obj);
  } catch (e) {
    console.error('CRASH IN PUSH:', e.message);
  }
}

testFleet();
