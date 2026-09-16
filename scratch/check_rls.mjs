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

async function checkRLS() {
  console.log("=== VERIFICANDO RLS DE DIARIAS_EVENTOS E LICITACAO_PROCESSOS ===");
  // Vamos consultar as policies via RPC ou information_schema ou testar com auth
  // Primeiro, vamos tentar logar com um usuário ou ver os usuários em auth.users
  // Como temos a anon key, podemos tentar ver se há alguma RPC de sistema ou testar queries
  
  // Vamos testar se existe alguma policy com erro
  const { data: d1, error: e1 } = await supabase.from('diarias_eventos').select('*').limit(1);
  console.log("diarias_eventos anon select:", e1 ? e1.message : "OK");

  const { data: d2, error: e2 } = await supabase.from('licitacao_processos').select('*').limit(1);
  console.log("licitacao_processos anon select:", e2 ? e2.message : "OK");
}

checkRLS();
