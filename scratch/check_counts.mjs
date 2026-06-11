import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function counts() {
    const tables = [
        'profiles',
        'purchase_orders',
        'oficios',
        'diarias_eventos',
        'vehicles',
        'abastecimentos',
        'licitacao_processos',
        'licitacao_itens'
    ];
    for (const t of tables) {
        try {
            const { count, error } = await supabase
                .from(t)
                .select('*', { count: 'exact', head: true });
            if (error) {
                console.log(`Table ${t}: error - ${error.message}`);
            } else {
                console.log(`Table ${t}: ${count} rows`);
            }
        } catch (e) {
            console.log(`Table ${t}: exception - ${e.message}`);
        }
    }
}
counts();
