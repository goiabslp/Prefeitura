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

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing credentials in env files");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { data, error } = await supabase.from('consultas_procedimentos').select('*');
    if (error) {
        console.error("Error fetching procedures:", error.message);
    } else {
        console.log("Procedures from DB:");
        console.log(JSON.stringify(data, null, 2));
    }
}

check();
