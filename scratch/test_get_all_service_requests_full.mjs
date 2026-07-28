import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

function loadEnv(filepath) {
    if (!fs.existsSync(filepath)) return;
    const content = fs.readFileSync(filepath, 'utf8');
    for (const line of content.split('\n')) {
        const clean = line.trim();
        if (!clean || clean.startsWith('#')) continue;
        const index = clean.indexOf('=');
        if (index === -1) continue;
        const key = clean.substring(0, index).trim();
        const value = clean.substring(index + 1).trim().replace(/^['"]|['"]$/g, '');
        process.env[key] = value;
    }
}
loadEnv('.env.local');
loadEnv('.env');

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function test() {
    const { data: eventosData, error: errEvt } = await supabase.from('diarias_eventos').select('*');
    console.log('errEvt:', errEvt);
    console.log('eventosData count:', eventosData?.length);

    const { data: delData, error: delErr } = await supabase.from('organization_settings').select('value').eq('id', 'global_deleted_event_ids').single();
    console.log('deleted ids data:', delData, 'err:', delErr);
}
test();
