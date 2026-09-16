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

async function testAllLancamentosCalls() {
  console.log("1. sectors...");
  const r1 = await supabase.from('sectors').select('id, name');
  console.log("sectors result:", r1.error ? r1.error : `OK (${r1.data.length})`);

  console.log("2. profiles...");
  const r2 = await supabase.from('profiles').select('id, name, username, email, sector, role, status');
  console.log("profiles result:", r2.error ? r2.error : `OK (${r2.data.length})`);

  console.log("3. jobs...");
  const r3 = await supabase.from('jobs').select('id, name');
  console.log("jobs result:", r3.error ? r3.error : `OK (${r3.data.length})`);

  console.log("4. persons...");
  const r4 = await supabase.from('persons').select('id, name, sector_id, job_id, birth_date, driver_code');
  console.log("persons result:", r4.error ? r4.error : `OK (${r4.data.length})`);

  console.log("5. diarias_gestores...");
  const r5 = await supabase.from('diarias_gestores').select('pessoa_id, gestor_id');
  console.log("diarias_gestores result:", r5.error ? r5.error : `OK (${r5.data.length})`);

  console.log("6. getAllDiariaEventos (DIARIA_EVENTO_COLUMNS)...");
  const DIARIA_EVENTO_COLUMNS = 'id, pessoas, destino, data_saida, data_retorno, motivo, setor_id, user_id, user_name, created_at, status, justificativa_gestor, comprovantes_gestor, valor_diaria, relatorio_viagem, hospedagem, hospedagem_dias, veiculo, veiculo_outro, distancia, gestor_transferido_cargo, digital_signature, checklist, modo_inicio, saida_validada';
  const r6 = await supabase.from('diarias_eventos').select(DIARIA_EVENTO_COLUMNS).order('created_at', { ascending: false }).limit(500);
  console.log("diarias_eventos result:", r6.error ? r6.error : `OK (${r6.data.length})`);

  console.log("7. getLicitacaoProcesses (LICITACAO_COLUMNS)...");
  const LICITACAO_COLUMNS = 'id, protocolo, finalidade, prioridade, solicitante_nome, solicitante_cargo, solicitante_setor, status, criado_por, criado_em, atualizado_em, fase, ficha_orcamentaria, resolucao_descricao, resolucao_numero, checkin_finalizado, aprovado_em, enviado_kanban_em, apresentado_animacao, oculto_kanban_view';
  const r7 = await supabase.from('licitacao_processos').select(LICITACAO_COLUMNS).order('criado_em', { ascending: false });
  console.log("licitacao_processos result:", r7.error ? r7.error : `OK (${r7.data.length})`);
}

testAllLancamentosCalls();
