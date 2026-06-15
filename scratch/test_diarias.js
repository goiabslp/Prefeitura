import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lntphzphyqnscdxyauzj.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxudHBoenBoeXFuc2NkeHlhdXpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4NzkzMzksImV4cCI6MjA4MjQ1NTMzOX0.3yCGZx-Wjoqv-FNHaEnlxdFpjjnSl9ynGZzG70yD-Fw';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
    try {
        console.log("Logging in...");
        const loginRes = await supabase.auth.signInWithPassword({
            email: 'gaf@projeto.local',
            password: 'gaf'
        });

        if (loginRes.error) {
            console.error('Login error:', loginRes.error);
            return;
        }

        console.log("Logged in successfully. Fetching service requests...");
        const { data, error } = await supabase
            .from('service_requests')
            .select('id, protocol, title, user_name, payment_status, document_snapshot')
            .limit(3);

        if (error) {
            console.error('Error returned from Supabase:', error);
            return;
        }

        console.log(`Fetched ${data ? data.length : 0} rows.`);
        if (data) {
            data.forEach((row, i) => {
                console.log(`\nRow ${i+1}:`);
                console.log(`ID: ${row.id}`);
                console.log(`Protocol: ${row.protocol}`);
                console.log(`Title: ${row.title}`);
                console.log(`User Name: ${row.user_name}`);
                console.log(`Payment Status: ${row.payment_status}`);
                console.log(`Has snapshot: ${!!row.document_snapshot}`);
                if (row.document_snapshot) {
                    console.log(`Snapshot Content Keys:`, Object.keys(row.document_snapshot.content || {}));
                    console.log(`RequesterName:`, row.document_snapshot.content?.requesterName);
                    console.log(`Destination:`, row.document_snapshot.content?.destination);
                    console.log(`DepartureDateTime:`, row.document_snapshot.content?.departureDateTime);
                }
            });
        }
    } catch (err) {
        console.error('Exception caught:', err);
    }
}

run();
