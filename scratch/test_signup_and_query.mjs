import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
    const email = `temp_${Date.now()}@prefeitura.mg.gov.br`;
    const password = 'TempPassword123!';

    console.log(`Trying to sign up temp user: ${email}...`);
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password
    });

    if (signUpError) {
        console.error("Sign up failed:", signUpError.message);
        return;
    }

    const user = signUpData.user;
    console.log("Sign up success! User ID:", user?.id);

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

    console.log("Querying profiles count...");
    try {
        const { count, error } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
        if (error) throw error;
        console.log("Profiles count:", count);
    } catch (e) {
        console.log("Profiles query failed:", e.message);
    }

    console.log("Querying purchase_orders count...");
    try {
        const { count, error } = await supabase.from('purchase_orders').select('*', { count: 'exact', head: true });
        if (error) throw error;
        console.log("Purchase orders count:", count);
    } catch (e) {
        console.log("Purchase orders query failed:", e.message);
    }

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

    // Cleanup user
    // Since we don't have admin privileges to delete auth users, we'll just leave it or let it be.
}

run();
