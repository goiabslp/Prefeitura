import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('.env', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
        env[parts[0].trim()] = parts.slice(1).join('=').trim();
    }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function testTrigger() {
    console.log("Fetching databases...");
    const { data: profiles, error: pErr } = await supabase.from('profiles').select('*').limit(5);
    const { data: patients, error: patErr } = await supabase.from('consultas_pacientes').select('*').limit(5);
    const { data: procedures, error: procErr } = await supabase.from('consultas_procedimentos').select('*').limit(5);

    console.log("Profiles count:", profiles?.length, "Error:", pErr?.message);
    console.log("Patients count:", patients?.length, "Error:", patErr?.message);
    console.log("Procedures count:", procedures?.length, "Error:", procErr?.message);

    if (profiles && profiles.length > 0) {
        console.log("Sample Profile ID:", profiles[0].id);
    }
}

testTrigger();
