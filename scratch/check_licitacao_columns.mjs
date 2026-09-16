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

async function inspectLicitacao() {
  console.log("=== INSPECIONANDO LICITACAO_PROCESSOS ===");
  const { data, error } = await supabase
    .from('licitacao_processos')
    .select('*')
    .limit(1);

  if (error) {
    console.error("Erro ao selecionar * de licitacao_processos:", error);
  } else {
    console.log("Colunas reais de licitacao_processos:", data && data[0] ? Object.keys(data[0]) : "Sem registros");
    if (data && data[0]) console.log("Amostra:", data[0]);
  }

  // Também verificar as tabelas relacionadas de licitacao
  const tables = ['licitacao_itens', 'licitacao_justificativas', 'licitacao_assinaturas', 'licitacao_documentos', 'licitacao_permissoes'];
  for (const tbl of tables) {
    const { data: d, error: err } = await supabase.from(tbl).select('*').limit(1);
    if (err) {
      console.error(`Erro em ${tbl}:`, err.message);
    } else {
      console.log(`Colunas de ${tbl}:`, d && d[0] ? Object.keys(d[0]) : "Vazio / OK");
    }
  }
}

inspectLicitacao();
