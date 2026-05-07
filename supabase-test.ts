import { supabase } from './services/supabaseClient';

async function test() {
    const { data } = await supabase.from('licitacao_processos').select('*, licitacao_itens (*), licitacao_justificativas (*)').limit(1);
    console.log(JSON.stringify(data, null, 2));
}

test();
