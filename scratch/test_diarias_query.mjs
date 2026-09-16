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

const DIARIA_EVENTO_COLUMNS = 'id, pessoas, destino, data_saida, data_retorno, motivo, setor_id, user_id, user_name, created_at, status, justificativa_gestor, comprovantes_gestor, valor_diaria, relatorio_viagem, hospedagem, hospedagem_dias, veiculo, veiculo_outro, distancia, gestor_transferido_cargo, digital_signature, checklist, modo_inicio, saida_validada';

async function testDiarias() {
  const { data, error } = await supabase
    .from('diarias_eventos')
    .select(DIARIA_EVENTO_COLUMNS)
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error("ERRO em diarias_eventos:", error);
  } else {
    console.log("SUCESSO em diarias_eventos! Registros:", data.length);
  }
}

testDiarias();
