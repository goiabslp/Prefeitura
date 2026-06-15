import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lntphzphyqnscdxyauzj.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxudHBoenBoeXFuc2NkeHlhdXpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4NzkzMzksImV4cCI6MjA4MjQ1NTMzOX0.3yCGZx-Wjoqv-FNHaEnlxdFpjjnSl9ynGZzG70yD-Fw';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
    try {
        console.log("Checking tables...");
        const tables = ['service_requests', 'vehicles', 'profiles'];
        for (const t of tables) {
            console.log(`\nQuerying table: ${t}...`);
            const start = Date.now();
            const { count, error } = await supabase
                .from(t)
                .select('*', { count: 'exact', head: true });
            if (error) {
                console.error(`Error querying ${t}:`, error.message);
            } else {
                console.log(`Table ${t}: ${count} rows (completed in ${Date.now() - start}ms)`);
            }
        }
    } catch (e) {
        console.error("Exception:", e);
    }
}

run();
