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
    // 1. service_requests query
    const { data: srData, error: srErr } = await supabase.from('service_requests').select('*');
    console.log('service_requests count:', srData?.length, 'err:', srErr);

    // 2. diarias_eventos query
    const { data: evtData, error: evtErr } = await supabase.from('diarias_eventos').select('*');
    console.log('diarias_eventos count:', evtData?.length, 'err:', evtErr);
}
test();
