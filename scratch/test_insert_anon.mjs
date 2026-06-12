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

const columnsToTest = [
    'id',
    'user_id',
    'user_name',
    'user_email',
    'action_type',
    'module',
    'description',
    'details',
    'created_at'
];

async function testColumns() {
    for (const col of columnsToTest) {
        const payload = {};
        // Use placeholder value based on column name
        if (col === 'id' || col === 'user_id') {
            payload[col] = '00000000-0000-0000-0000-000000000000';
        } else if (col === 'details') {
            payload[col] = {};
        } else if (col === 'created_at') {
            payload[col] = new Date().toISOString();
        } else {
            payload[col] = 'test';
        }

        const { error } = await supabase.from('audit_logs').insert([payload]);
        if (error) {
            console.log(`Column '${col}':`, error.message);
        } else {
            console.log(`Column '${col}': SUCCESS (no error)`);
        }
    }
}

testColumns();
