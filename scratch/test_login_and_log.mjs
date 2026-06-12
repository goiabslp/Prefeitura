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

async function run() {
    const email = `test_audit_${Date.now()}@prefeitura.mg.gov.br`;
    const password = 'TempPassword123!';

    console.log(`Signing up temp user: ${email}...`);
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password
    });

    if (signUpError) {
        console.error("Sign up failed:", signUpError.message);
        return;
    }

    const sessionUser = signUpData.user;
    console.log("Sign up success! User ID:", sessionUser?.id);

    // Wait 1 second for any triggers
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Sign in to make sure session is active
    console.log("Signing in...");
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password
    });

    if (signInError) {
        console.error("Sign in failed:", signInError.message);
        return;
    }

    console.log("Sign in success!");

    // Try to query profile
    console.log("Fetching profile...");
    const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', sessionUser.id)
        .single();
    
    console.log("Profile Error:", profileErr);
    console.log("Profile Data:", profile);

    // Try to insert a log
    console.log("Inserting log...");
    const { data: logData, error: logErr } = await supabase.from('audit_logs').insert([{
        user_id: sessionUser.id,
        user_name: profile?.name || sessionUser.email || 'Test User',
        user_email: sessionUser.email || '',
        action_type: 'click',
        module: 'test',
        description: 'Test action from node script',
        details: { test: true }
    }]);

    console.log("Log insertion error:", logErr);
    console.log("Log insertion data:", logData);

    // Try to fetch logs
    console.log("Fetching all logs...");
    const { data: logs, error: fetchErr } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false });
    
    console.log("Fetch Error:", fetchErr);
    console.log("Fetched Logs Count:", logs ? logs.length : 0);
    if (logs && logs.length > 0) {
        console.log("Latest log:", logs[0]);
    }
}

run();
