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

async function testProcessById() {
  const testId = '57d53e9b-8c02-4c26-8967-ac0ba267ed27';
  const { data, error } = await supabase
    .from('licitacao_processos')
    .select(`
        *,
        licitacao_itens (*),
        licitacao_justificativas (*),
        licitacao_assinaturas (*),
        licitacao_documentos (*)
    `)
    .eq('id', testId)
    .single();

  if (error) {
    console.error("ERRO getLicitacaoProcessById:", error);
  } else {
    console.log("SUCESSO getLicitacaoProcessById! Protocolo:", data.protocolo);
    console.log("Itens count:", data.licitacao_itens?.length);
    console.log("Justificativas count:", data.licitacao_justificativas?.length);
  }
}

testProcessById();
