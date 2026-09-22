import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lntphzphyqnscdxyauzj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxudHBoenBoeXFuc2NkeHlhdXpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4NzkzMzksImV4cCI6MjA4MjQ1NTMzOX0.3yCGZx-Wjoqv-FNHaEnlxdFpjjnSl9ynGZzG70yD-Fw';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: org, error } = await supabase.from('organization_settings').select('*').eq('id', 'global_config').maybeSingle();
  console.log('Org settings keys:', org ? Object.keys(org) : null);
  console.log('UI config keys:', org?.ui_config ? Object.keys(org.ui_config) : null);
  console.log('UI config content sample:', JSON.stringify(org?.ui_config, null, 2));
}

main().catch(console.error);
