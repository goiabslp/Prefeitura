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

const LICITACAO_COLUMNS = 'id, protocolo, finalidade, prioridade, solicitante_nome, solicitante_cargo, solicitante_setor, status, criado_por, criado_em, atualizado_em, fase, ficha_orcamentaria, resolucao_descricao, resolucao_numero, checkin_finalizado, aprovado_em, enviado_kanban_em, apresentado_animacao, oculto_kanban_view';

async function testLicitacaoQuery() {
  const { data, error } = await supabase
    .from('licitacao_processos')
    .select(LICITACAO_COLUMNS)
    .order('criado_em', { ascending: false });

  if (error) {
    console.error("ERRO na nova query:", error);
  } else {
    console.log("SUCESSO ABSOLUTO! Processos retornados:", data.length);
    console.log("Primeiro processo:", data[0]);
  }
}

testLicitacaoQuery();
