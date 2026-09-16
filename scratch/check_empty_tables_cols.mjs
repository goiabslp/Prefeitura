import { createClient } from '@supabase/supabase-js';

const url = 'https://lntphzphyqnscdxyauzj.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxudHBoenBoeXFuc2NkeHlhdXpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4NzkzMzksImV4cCI6MjA4MjQ1NTMzOX0.3yCGZx-Wjoqv-FNHaEnlxdFpjjnSl9ynGZzG70yD-Fw';
const sb = createClient(url, key);

async function checkCols() {
  // Testando licitacao_permissoes
  const licCols = ['id', 'usuario_id', 'user_id', 'perfil', 'role', 'tipo_permissao', 'permissoes_especiais', 'criado_em', 'created_at'];
  for (const c of licCols) {
    const res = await sb.from('licitacao_permissoes').select(c).limit(1);
    if (!res.error) console.log('licitacao_permissoes TEM:', c);
  }

  // Testando consultas_vagas
  const vagasCols = ['id', 'procedimento_id', 'data', 'hora', 'quantidade', 'vagas', 'total_vagas', 'status', 'created_at'];
  for (const c of vagasCols) {
    const res = await sb.from('consultas_vagas').select(c).limit(1);
    if (!res.error) console.log('consultas_vagas TEM:', c);
  }

  // Testando abastecimento_scheduled_prices
  const priceCols = ['id', 'station_id', 'scheduled_date', 'fuel_prices', 'price', 'prices', 'status', 'created_at'];
  for (const c of priceCols) {
    const res = await sb.from('abastecimento_scheduled_prices').select(c).limit(1);
    if (!res.error) console.log('abastecimento_scheduled_prices TEM:', c);
  }
}

checkCols();
