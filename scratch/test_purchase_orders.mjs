import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function runTests() {
    console.log("Starting purchase_orders query tests...");

    // Test 1: Simple count or small select without JSON parsing and join
    console.log("\n--- Test 1: Select only id, protocol, title ---");
    const start1 = Date.now();
    try {
        const { data, error } = await supabase
            .from('purchase_orders')
            .select('id, protocol, title')
            .limit(5);
        if (error) throw error;
        console.log(`Success in ${Date.now() - start1}ms. Records:`, data.length);
    } catch (err) {
        console.error(`Failed in ${Date.now() - start1}ms:`, err.message);
    }

    // Test 2: Select with profiles join
    console.log("\n--- Test 2: Select with profiles:user_id(sector) join ---");
    const start2 = Date.now();
    try {
        const { data, error } = await supabase
            .from('purchase_orders')
            .select('id, protocol, profiles:user_id(sector)')
            .limit(5);
        if (error) throw error;
        console.log(`Success in ${Date.now() - start2}ms. Records:`, data.length);
    } catch (err) {
        console.error(`Failed in ${Date.now() - start2}ms:`, err.message);
    }

    // Test 3: Select with JSON paths
    console.log("\n--- Test 3: Select with JSON parsing path ---");
    const start3 = Date.now();
    try {
        const { data, error } = await supabase
            .from('purchase_orders')
            .select('id, reqName:document_snapshot->content->>requesterName')
            .limit(5);
        if (error) throw error;
        console.log(`Success in ${Date.now() - start3}ms. Records:`, data.length);
    } catch (err) {
        console.error(`Failed in ${Date.now() - start3}ms:`, err.message);
    }

    // Test 4: Full lightweight query as implemented in comprasService
    console.log("\n--- Test 4: Lightweight query as in comprasService ---");
    const start4 = Date.now();
    try {
        const columns = `id, protocol, title, status, purchase_status, status_history, created_at, user_id, user_name, completion_forecast, budget_file_url, reqName:document_snapshot->content->>requesterName, reqSector:document_snapshot->content->>requesterSector, reqPriority:document_snapshot->content->>priority, reqAccount:document_snapshot->content->>selectedAccount, profiles:user_id(sector)`;
        const { data, error } = await supabase
            .from('purchase_orders')
            .select(columns)
            .order('created_at', { ascending: false })
            .range(0, 49);
        if (error) throw error;
        console.log(`Success in ${Date.now() - start4}ms. Records:`, data.length);
    } catch (err) {
        console.error(`Failed in ${Date.now() - start4}ms:`, err.message);
    }
}

runTests();
