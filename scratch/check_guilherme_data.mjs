import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lntphzphyqnscdxyauzj.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxudHBoenBoeXFuc2NkeHlhdXpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4NzkzMzksImV4cCI6MjA4MjQ1NTMzOX0.3yCGZx-Wjoqv-FNHaEnlxdFpjjnSl9ynGZzG70yD-Fw';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkData() {
    const email = `check${Date.now()}@gmail.com`;
    const password = 'TempPassword123!';

    console.log("Criando usuário temporário...");
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password
    });

    if (signUpError) {
        console.error("Erro no Sign Up:", signUpError.message);
        return;
    }

    if (signUpData.session) {
        console.log("Sessão obtida diretamente no Sign Up!");
        await supabase.auth.setSession(signUpData.session);
    } else {
        console.log("Sem sessão direta no Sign Up (email não confirmado). Testando consultas diretamente...");
    }

    console.log("\n=== BUSCANDO MOVIMENTAÇÕES DE GUILHERME ===");
    const { data: movs, error: movErr } = await supabase
        .from('farmacia_movimentacoes')
        .select('*');
        
    if (movErr) {
        console.error("Erro ao buscar movimentações:", movErr);
    } else {
        console.log(`Total de movimentações encontradas na tabela: ${movs ? movs.length : 0}`);
        if (movs && movs.length > 0) {
            movs.forEach(m => {
                console.log(`- [MOV ID: ${m.id}] Tipo: ${m.tipo} | Qtd: ${m.quantidade} | Med: ${m.medicamento_nome} (ID: ${m.medicamento_id}) | Resp: '${m.responsavel_nome}' (ID: ${m.responsavel_id}) | Paciente: '${m.paciente_nome}' | Data: ${m.data}`);
            });
        }
    }

    console.log("\n=== BUSCANDO MEDICAMENTOS EM FARMACIA_MEDICAMENTOS ===");
    const { data: meds, error: medErr } = await supabase
        .from('farmacia_medicamentos')
        .select('*');
        
    if (medErr) {
        console.error("Erro ao buscar medicamentos:", medErr);
    } else {
        console.log(`Total de medicamentos no estoque: ${meds ? meds.length : 0}`);
        if (meds && meds.length > 0) {
            meds.forEach(m => {
                console.log(`- [MED ID: ${m.id}] Nome: ${m.nome} | Qtd: ${m.quantidade} | Cat: ${m.categoria} | Lote: ${m.lote} | Validade: ${m.validade}`);
            });
        }
    }

    console.log("\n=== BUSCANDO PERFIS EM PROFILES ===");
    const { data: profiles, error: profErr } = await supabase
        .from('profiles')
        .select('*');
    if (profErr) {
        console.error("Erro ao buscar profiles:", profErr);
    } else {
        console.log(`Total de perfis: ${profiles ? profiles.length : 0}`);
        if (profiles && profiles.length > 0) {
            profiles.forEach(p => {
                console.log(`- [PROFILE ID: ${p.id}] Nome: ${p.nome_completo || p.name || p.email} | Email: ${p.email}`);
            });
        }
    }
}

checkData();
