import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const url = 'https://lntphzphyqnscdxyauzj.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxudHBoenBoeXFuc2NkeHlhdXpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4NzkzMzksImV4cCI6MjA4MjQ1NTMzOX0.3yCGZx-Wjoqv-FNHaEnlxdFpjjnSl9ynGZzG70yD-Fw';
const sb = createClient(url, key);

const servicesDir = 'services';
const files = fs.readdirSync(servicesDir).filter(f => f.endsWith('.ts'));

console.log(`Auditorando ${files.length} arquivos de serviços...`);

const results = [];

for (const file of files) {
  const content = fs.readFileSync(path.join(servicesDir, file), 'utf8');
  
  // Procura por supabase.from('...').select('...')
  const regex = /from\(['"]([a-zA-Z0-9_-]+)['"]\)\s*\.select\(([`'"][^`'"]*[`'"])/g;
  let match;
  
  while ((match = regex.exec(content)) !== null) {
    const table = match[1];
    let selectRaw = match[2];
    // Remove aspas/backticks e espaços
    let selectCols = selectRaw.slice(1, -1).trim();
    
    // Ignora se for interpolação ou apenas contagem head: true
    if (selectCols.includes('${')) continue;
    
    results.push({ file, table, selectCols });
  }
}

console.log(`Encontradas ${results.length} consultas explícitas. Testando no Supabase...`);

async function run() {
  const errors = [];
  const success = [];

  for (const item of results) {
    try {
      const res = await sb.from(item.table).select(item.selectCols).limit(1);
      if (res.error) {
        errors.push({
          file: item.file,
          table: item.table,
          selectCols: item.selectCols,
          error: res.error.message,
          code: res.error.code
        });
      } else {
        success.push({
          file: item.file,
          table: item.table
        });
      }
    } catch (e) {
      errors.push({
        file: item.file,
        table: item.table,
        selectCols: item.selectCols,
        error: e.message
      });
    }
  }

  console.log(`\n=== RESULTADO DA AUDITORIA ===`);
  console.log(`Consultas com SUCESSO: ${success.length}`);
  console.log(`Consultas com ERRO: ${errors.length}\n`);

  for (const err of errors) {
    console.log(`❌ [${err.file}] Tabela: ${err.table}`);
    console.log(`   Colunas: ${err.selectCols}`);
    console.log(`   Erro: (${err.code}) ${err.error}\n`);
  }

  fs.writeFileSync('scratch/audit_results_real.json', JSON.stringify(errors, null, 2));
}

run();
