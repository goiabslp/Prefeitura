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
const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect(tableName) {
    console.log(`\n--- Inspecting columns for table: ${tableName} ---`);
    const { data, error } = await supabase.from(tableName).select('*').limit(1);
    if (error) {
        console.error(`Error querying ${tableName}:`, error.message);
        return;
    }
    if (data && data.length > 0) {
        console.log(`Columns in ${tableName}:`, Object.keys(data[0]));
        console.log(`Sample row:`, JSON.stringify(data[0], null, 2));
    } else {
        console.log(`No rows in ${tableName}.`);
    }
}

async function run() {
    await inspect('purchase_orders');
    await inspect('oficios');
    await inspect('service_requests');
}

run();
