import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
    console.log("Querying one purchase order...");
    const { data, error } = await supabase
        .from('purchase_orders')
        .select('*')
        .limit(1);

    if (error) {
        console.error("Query failed:", error.message);
        return;
    }

    if (data && data.length > 0) {
        console.log("Columns of purchase_orders:", Object.keys(data[0]));
    } else {
        console.log("No records found in purchase_orders, querying table metadata...");
        // Fallback: query from information_schema if possible
        const { data: cols, error: colErr } = await supabase
            .from('information_schema.columns')
            .select('column_name')
            .eq('table_name', 'purchase_orders');
        if (colErr) {
            console.error("Metadata query failed:", colErr.message);
        } else {
            console.log("Columns:", cols.map(c => c.column_name));
        }
    }
}

run();
