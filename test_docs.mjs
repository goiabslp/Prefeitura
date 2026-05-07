import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDocs() {
    const { data, error } = await supabase.from('licitacao_documentos').select('*');
    if (error) {
        console.error("Error fetching licitacao_documentos:", error.message);
    } else {
        console.log(`Found ${data.length} documents.`);
        console.log(data);
    }
}

checkDocs();
