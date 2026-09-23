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

async function inspect() {
  const selectedDateStr = '2026-09-23';
  const horaInicial = '05:00';
  const horaFinal = '12:00';

  // Timestamps da consulta local (UTC-3)
  const [y, m, d] = selectedDateStr.split('-').map(Number);
  const [hIni, mIni] = horaInicial.split(':').map(Number);
  const [hFim, mFim] = horaFinal.split(':').map(Number);

  const startLocal = new Date(y, m - 1, d, hIni, mIni, 0);
  const endLocal = new Date(y, m - 1, d, hFim, mFim, 0);

  const queryStartIso = startLocal.toISOString();
  const queryEndIso = endLocal.toISOString();

  console.log(`Período da Consulta (Local): ${startLocal.toLocaleString('pt-BR')} até ${endLocal.toLocaleString('pt-BR')}`);
  console.log(`Período da Consulta (ISO): ${queryStartIso} até ${queryEndIso}`);

  // Busca todos os agendamentos que não estejam cancelados
  const { data: scheds, error: sErr } = await supabase
    .from('vehicle_schedules')
    .select('id, vehicle_id, status, departure_date_time, return_date_time, protocol')
    .not('status', 'in', '("cancelado","rejeitado")');

  console.log(`Total de agendamentos não cancelados no banco: ${scheds?.length}`);

  const startMs = startLocal.getTime();
  const endMs = endLocal.getTime();

  const busyVehicleIds = new Set();
  const conflitosEncontrados = [];

  (scheds || []).forEach(s => {
    if (!s.vehicle_id || !s.departure_date_time || !s.return_date_time) return;

    const sStartMs = new Date(s.departure_date_time).getTime();
    const sEndMs = new Date(s.return_date_time).getTime();

    // Regra correta de sobreposição:
    // inicio_consulta < fim_agendamento E fim_consulta > inicio_agendamento
    const isOverlapping = (startMs < sEndMs) && (endMs > sStartMs);

    if (isOverlapping) {
      busyVehicleIds.add(s.vehicle_id);
      conflitosEncontrados.push({
        protocol: s.protocol,
        vehicle_id: s.vehicle_id,
        status: s.status,
        saida: new Date(s.departure_date_time).toLocaleString('pt-BR'),
        retorno: new Date(s.return_date_time).toLocaleString('pt-BR')
      });
    }
  });

  console.log(`\nVeículos conflitantes / ocupados encontrados (${busyVehicleIds.size}):`);
  console.log(conflitosEncontrados);

  // Verifica se a SPIN RVW3F73 (696b449c-f061-4364-9c8c-dcffa83c89d4) foi bloqueada
  const spinId = '696b449c-f061-4364-9c8c-dcffa83c89d4';
  console.log(`\nA SPIN RVW3F73 foi bloqueada corretamente? ${busyVehicleIds.has(spinId) ? 'SIM (BLOQUEADA COM SUCESSO)' : 'NÃO (ERRO)'}`);
}
inspect();
