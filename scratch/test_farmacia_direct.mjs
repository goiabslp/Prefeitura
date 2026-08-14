import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://lntphzphyqnscdxyauzj.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxudHBoenBoeXFuc2NkeHlhdXpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4NzkzMzksImV4cCI6MjA4MjQ1NTMzOX0.3yCGZx-Wjoqv-FNHaEnlxdFpjjnSl9ynGZzG70yD-Fw';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testDirect() {
    console.log("--- TESTANDO SELECT DIRETO FARMACIA_MEDICAMENTOS ---");
    const { data: meds, error: errMeds } = await supabase.from('farmacia_medicamentos').select('*').limit(10);
    console.log("Meds Error:", errMeds);
    console.log("Meds Data Count:", meds?.length);
    if (meds && meds.length > 0) {
        console.log("Amostra Meds:", meds.slice(0, 3));
    }

    console.log("\n--- TESTANDO SELECT DIRETO FARMACIA_MOVIMENTACOES ---");
    const { data: movs, error: errMovs } = await supabase.from('farmacia_movimentacoes').select('*').limit(10);
    console.log("Movs Error:", errMovs);
    console.log("Movs Data Count:", movs?.length);
    if (movs && movs.length > 0) {
        console.log("Amostra Movs:", movs.slice(0, 5));
    }

    console.log("\n--- TESTANDO BUSCA POR GUILHERME EM TODAS AS TABELAS ---");
    const { data: gMovs, error: errGMovs } = await supabase
        .from('farmacia_movimentacoes')
        .select('*')
        .or('responsavel_nome.ilike.%Guilherme%,paciente_nome.ilike.%Guilherme%');
    console.log("Movs de Guilherme:", gMovs);
}

testDirect();
