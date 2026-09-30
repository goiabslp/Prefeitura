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

async function testUpdate() {
  console.log("--- TESTANDO BUSCA DE AGENDAMENTO CANCELADO ---");
  const { data: cancelled, error: findError } = await supabase
    .from('vehicle_schedules')
    .select('*')
    .eq('status', 'cancelado')
    .limit(1);

  if (findError) {
    console.error("Erro ao buscar cancelado:", findError);
    return;
  }

  if (!cancelled || cancelled.length === 0) {
    console.log("Nenhum agendamento cancelado encontrado no DB.");
    return;
  }

  const doc = cancelled[0];
  console.log("Agendamento cancelado encontrado:", doc.id, doc.protocol);

  console.log("--- TESTANDO DIRECT UPDATE DE CANCELADO PARA CONFIRMADO ---");
  const { data: upData, error: upError } = await supabase
    .from('vehicle_schedules')
    .update({ status: 'confirmado' })
    .eq('id', doc.id)
    .select();

  console.log("upError:", upError);
  console.log("upData:", upData);

  if (upError) {
    console.log("--- TESTANDO DELETE + RE-INSERT FALLBACK ---");
    // Tenta re-inserir após deletar
    const { error: delErr } = await supabase
      .from('vehicle_schedules')
      .delete()
      .eq('id', doc.id);

    console.log("delErr:", delErr);

    if (!delErr) {
      const { data: inData, error: inErr } = await supabase
        .from('vehicle_schedules')
        .insert([{
          ...doc,
          status: 'confirmado'
        }])
        .select();

      console.log("inErr:", inErr);
      console.log("inData:", inData);
    }
  } else {
    // Restaura para cancelado se deu certo
    await supabase.from('vehicle_schedules').update({ status: 'cancelado' }).eq('id', doc.id);
  }
}

testUpdate();
