import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
    const { data } = await supabase.from('licitacao_processos').select('*, licitacao_itens (*), licitacao_justificativas (*)').limit(1);
    console.log(JSON.stringify(data, null, 2));
}

test();
