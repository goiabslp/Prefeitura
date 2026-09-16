import { createClient } from '@supabase/supabase-js';

const url = 'https://lntphzphyqnscdxyauzj.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxudHBoenBoeXFuc2NkeHlhdXpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4NzkzMzksImV4cCI6MjA4MjQ1NTMzOX0.3yCGZx-Wjoqv-FNHaEnlxdFpjjnSl9ynGZzG70yD-Fw';
const sb = createClient(url, key);

async function inspectTables() {
  const tables = [
    'diarias_eventos',
    'consultas_vagas',
    'calendar_events',
    'abastecimento_reports_history',
    'abastecimento_scheduled_prices',
    'procurement_inventory_imports',
    'licitacao_permissoes',
    'operation_codes',
    'profiles',
    'noticias'
  ];

  console.log('=== INSPEÇÃO DE COLUNAS REAIS NO SUPABASE ===\n');

  for (const t of tables) {
    const res = await sb.from(t).select('*').limit(1);
    if (res.error) {
      console.log(`❌ Tabela ${t}: ERRO:`, res.error.message);
    } else {
      const cols = res.data && res.data[0] ? Object.keys(res.data[0]) : '(tabela vazia, testando colunas conhecidas)';
      console.log(`✅ Tabela ${t}:`, cols);
    }
  }
}

inspectTables();
