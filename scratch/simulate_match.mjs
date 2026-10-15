import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import { parseISO, isValid } from 'date-fns';

const envContent = fs.readFileSync('.env', 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const [k, ...v] = line.split('=');
  if (k && v.length) env[k.trim()] = v.join('=').trim().replace(/^['"]|['"]$/g, '');
});
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

const cleanPlate = (p) => (p || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
const normalizeStr = (str) => {
  if (!str) return '';
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
};

async function testMatch() {
  const { data: vehicles } = await supabase.from('vehicles').select('*');
  const { data: s } = await supabase.from('vehicle_schedules').select('*').eq('protocol', 'OS-2026830569949').single();

  const vehicleInput = 'FIAT ARGO • TXY2G82';
  const selectedVehicleId = ''; // O que acontece se selectedVehicleId não estava setado ou estava?
  const fineDate = '2026-10-14';
  const fineTime = '09:00';

  console.log('Testing with selectedVehicleId empty and vehicleInput:', vehicleInput);

  const rawInput = vehicleInput.trim();
  const matchedVehicle = vehicles.find(v => 
    (selectedVehicleId && v.id === selectedVehicleId) ||
    (rawInput && (
      cleanPlate(v.plate) === cleanPlate(rawInput) ||
      (cleanPlate(rawInput).length >= 5 && cleanPlate(v.plate).includes(cleanPlate(rawInput))) ||
      `${v.brand || ''} ${v.model} • ${v.plate}`.toLowerCase() === rawInput.toLowerCase()
    ))
  );

  console.log('matchedVehicle:', matchedVehicle ? { id: matchedVehicle.id, model: matchedVehicle.model, plate: matchedVehicle.plate } : null);

  const effectiveVehicleId = matchedVehicle?.id || selectedVehicleId;
  const targetPlateClean = cleanPlate(matchedVehicle?.plate || rawInput);

  console.log('effectiveVehicleId:', effectiveVehicleId);
  console.log('targetPlateClean:', targetPlateClean);

  // Agora simula o loop em schedules
  const scheduleVehicle = vehicles.find(v => v.id === s.vehicle_id);
  const isVehicleDirectMatch = Boolean(effectiveVehicleId && s.vehicle_id === effectiveVehicleId);
  const schedulePlateClean = cleanPlate(scheduleVehicle?.plate);
  
  const isPlateMatch = Boolean(
    targetPlateClean && 
    schedulePlateClean && 
    (schedulePlateClean === targetPlateClean || schedulePlateClean.includes(targetPlateClean) || targetPlateClean.includes(schedulePlateClean))
  );

  console.log('scheduleVehicle:', scheduleVehicle ? { id: scheduleVehicle.id, plate: scheduleVehicle.plate } : null);
  console.log('isVehicleDirectMatch:', isVehicleDirectMatch);
  console.log('isPlateMatch:', isPlateMatch);

  // Período
  const [hours, minutes] = fineTime.split(':').map(Number);
  const infractionTarget = new Date(`${fineDate}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`);
  const infractionTimestamp = infractionTarget.getTime();

  const depDate = parseISO(s.departure_date_time);
  const retDate = parseISO(s.return_date_time);

  const depTime = depDate.getTime();
  const retTime = retDate.getTime();

  console.log('infractionTarget:', infractionTarget.toString(), 'ts:', infractionTimestamp);
  console.log('depDate:', depDate.toString(), 'ts:', depTime);
  console.log('retDate:', retDate.toString(), 'ts:', retTime);
  console.log('infractionTimestamp >= depTime:', infractionTimestamp >= depTime);
  console.log('infractionTimestamp <= retTime:', infractionTimestamp <= retTime);

  // Ver se targetVehicle gerava erro de ReferenceError!
  try {
    const targetVehicleVal = eval('typeof targetVehicle !== "undefined" ? targetVehicle : undefined');
    console.log('targetVehicleVal:', targetVehicleVal);
  } catch (err) {
    console.log('targetVehicle eval error:', err.message);
  }
}

testMatch();
