import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lntphzphyqnscdxyauzj.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxudHBoenBoeXFuc2NkeHlhdXpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4NzkzMzksImV4cCI6MjA4MjQ1NTMzOX0.3yCGZx-Wjoqv-FNHaEnlxdFpjjnSl9ynGZzG70yD-Fw';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
    try {
        const email = `temp_${Date.now()}@projeto.local`;
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

        console.log("Sign up success! Signing in...");
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (signInError) {
            console.error("Sign in failed:", signInError.message);
            return;
        }

        console.log("Sign in success! Querying service_requests...");
        const columns = `id, protocol, title, status, created_at, user_id, user_name, payment_status, payment_date,
            reqName:document_snapshot->content->>requesterName,
            reqNameLegacy:document_snapshot->>requesterName,
            reqNameLegacyUnderscore:document_snapshot->content->>requester_name,
            dest:document_snapshot->content->>destination,
            destLegacy:document_snapshot->>destination,
            depDate:document_snapshot->content->>departureDateTime,
            depDateLegacy:document_snapshot->>departureDateTime,
            depDateLegacyUnderscore:document_snapshot->content->>departure_date,
            retDate:document_snapshot->content->>returnDateTime,
            retDateLegacy:document_snapshot->>returnDateTime,
            retDateLegacyUnderscore:document_snapshot->content->>return_date`;

        const { data, error } = await supabase
            .from('service_requests')
            .select(columns)
            .order('created_at', { ascending: false })
            .limit(5);

        if (error) {
            console.error('Error querying service_requests:', error);
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
                console.log(`reqName: ${row.reqName}`);
                console.log(`reqNameLegacy: ${row.reqNameLegacy}`);
                console.log(`reqNameLegacyUnderscore: ${row.reqNameLegacyUnderscore}`);
                console.log(`dest: ${row.dest}`);
                console.log(`destLegacy: ${row.destLegacy}`);
                console.log(`depDate: ${row.depDate}`);
                console.log(`depDateLegacy: ${row.depDateLegacy}`);
                console.log(`depDateLegacyUnderscore: ${row.depDateLegacyUnderscore}`);
                console.log(`retDate: ${row.retDate}`);
                console.log(`retDateLegacy: ${row.retDateLegacy}`);
                console.log(`retDateLegacyUnderscore: ${row.retDateLegacyUnderscore}`);
            });
        }

    } catch (err) {
        console.error('Exception caught:', err);
    }
}

run();
