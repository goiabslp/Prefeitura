import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const users = [
    { username: 'gaf', password: 'gaf' },
    { username: 'jmv', password: 'jmv' },
    { username: 'mdl', password: 'mdl' },
    { username: 'apoliana', password: '123' },
    { username: 'ves', password: 'ves' },
    { username: 'mvf', password: 'mvf' }
];

async function run() {
    for (const u of users) {
        const email = `${u.username}@projeto.local`;
        console.log(`Trying login for ${email}...`);
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password: u.password
        });
        if (!error) {
            console.log(`SUCCESS! Logged in as ${email}. User ID: ${data.user.id}`);
            return;
        } else {
            console.log(`Failed for ${email}: ${error.message}`);
        }
    }
    console.log("No default logins are valid.");
}

run();
