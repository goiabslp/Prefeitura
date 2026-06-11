import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkAuthQuery() {
    console.log("Attempting sign in as gaf@projeto.local...");
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: 'gaf@projeto.local',
        password: 'gaf'
    });

    if (authError) {
        console.error("Sign in failed:", authError.message);
        return;
    }

    console.log("Sign in successful! User ID:", authData.user.id);

    console.log("Running getAllPurchaseOrders (lightweight = true)...");
    const start = Date.now();
    try {
        const columns = `id, protocol, title, status, purchase_status, status_history, created_at, user_id, user_name, completion_forecast, budget_file_url, reqName:document_snapshot->content->>requesterName, reqSector:document_snapshot->content->>requesterSector, reqPriority:document_snapshot->content->>priority, reqAccount:document_snapshot->content->>selectedAccount, profiles:user_id(sector)`;
        const { data, error } = await supabase
            .from('purchase_orders')
            .select(columns)
            .order('created_at', { ascending: false })
            .range(0, 49);
        if (error) throw error;
        console.log(`Success in ${Date.now() - start}ms. Records:`, data?.length);
    } catch (err) {
        console.error(`Query failed in ${Date.now() - start}ms:`, err.message, err);
    }
}

checkAuthQuery();
