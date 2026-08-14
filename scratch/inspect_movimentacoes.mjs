import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lntphzphyqnscdxyauzj.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxudHBoenBoeXFuc2NkeHlhdXpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4NzkzMzksImV4cCI6MjA4MjQ1NTMzOX0.3yCGZx-Wjoqv-FNHaEnlxdFpjjnSl9ynGZzG70yD-Fw';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
    const email = `inspect${Date.now()}@gmail.com`;
    const password = 'TempPassword123!';

    const { data: signUpData } = await supabase.auth.signUp({ email, password });
    if (signUpData?.session) {
        await supabase.auth.setSession(signUpData.session);
    }

    const { data: movs, error } = await supabase.from('farmacia_movimentacoes').select('*');
    if (error) {
        console.error("Error:", error);
        return;
    }

    console.log(`Total movimentacoes no DB: ${movs?.length}`);
    if (movs) {
        let totalSaidaAll = 0;
        let totalSaidaThisMonth = 0;
        let totalSaidaLastMonth = 0;
        let invalidDates = 0;

        const now = new Date();
        const curYear = now.getFullYear();
        const curMonth = now.getMonth();

        movs.forEach(m => {
            if (m.tipo === 'Saída') {
                totalSaidaAll += (m.quantidade || 0);
                const d = new Date(m.data);
                if (isNaN(d.getTime())) {
                    invalidDates++;
                } else {
                    if (d.getFullYear() === curYear && d.getMonth() === curMonth) {
                        totalSaidaThisMonth += (m.quantidade || 0);
                    } else if (d.getFullYear() === curYear && d.getMonth() === curMonth - 1) {
                        totalSaidaLastMonth += (m.quantidade || 0);
                    }
                }
            }
            console.log(`- Tipo: ${m.tipo} | Qtd: ${m.quantidade} | Med: ${m.medicamento_nome} | Data: '${m.data}' | Resp: '${m.responsavel_nome}' | Pac: '${m.paciente_nome}'`);
        });

        console.log(`\nRESUMO DE SAÍDAS:`);
        console.log(`- Total de Saídas (Geral): ${totalSaidaAll}`);
        console.log(`- Total de Saídas (Este mês): ${totalSaidaThisMonth}`);
        console.log(`- Total de Saídas (Mês anterior): ${totalSaidaLastMonth}`);
        console.log(`- Datas inválidas: ${invalidDates}`);
    }
}

run();
