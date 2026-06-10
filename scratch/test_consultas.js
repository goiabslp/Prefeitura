import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lntphzphyqnscdxyauzj.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxudHBoenBoeXFuc2NkeHlhdXpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4NzkzMzksImV4cCI6MjA4MjQ1NTMzOX0.3yCGZx-Wjoqv-FNHaEnlxdFpjjnSl9ynGZzG70yD-Fw';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function runDiagnostics() {
    console.log('1. Checking connection...');
    const { data: bookings, error: selectError } = await supabase
        .from('consultas_agendamentos')
        .select('*')
        .limit(3);

    if (selectError) {
        console.error('Select error:', selectError);
        return;
    }
    console.log(`Successfully fetched ${bookings?.length || 0} bookings.`);
    if (bookings && bookings.length > 0) {
        const testBooking = bookings[0];
        console.log('First booking details:', {
            id: testBooking.id,
            status: testBooking.status,
            patient_id: testBooking.patient_id,
            procedimento_id: testBooking.procedimento_id,
            appointment_date: testBooking.appointment_date
        });

        // Test UPDATE status
        console.log('\n2. Testing UPDATE status...');
        const originalStatus = testBooking.status;
        const nextStatus = originalStatus === 'Cancelado' ? 'Agendado' : 'Cancelado';
        console.log(`Attempting to update status from "${originalStatus}" to "${nextStatus}"...`);
        const updateRes = await supabase
            .from('consultas_agendamentos')
            .update({ status: nextStatus })
            .eq('id', testBooking.id)
            .select();
        
        console.log('Update response error:', updateRes.error);
        console.log('Update response data:', updateRes.data);

        // Revert status
        console.log('\n3. Reverting status...');
        const revertRes = await supabase
            .from('consultas_agendamentos')
            .update({ status: originalStatus })
            .eq('id', testBooking.id)
            .select();
        console.log('Revert response error:', revertRes.error);
        console.log('Revert response data:', revertRes.data);

        // Test DELETE on a temporary record
        console.log('\n4. Testing INSERT + DELETE...');
        const tempBooking = {
            patient_id: testBooking.patient_id,
            procedimento_id: testBooking.procedimento_id,
            appointment_date: testBooking.appointment_date,
            quantity: 1,
            priority: 'Normal',
            status: 'Cancelado', 
            created_by: testBooking.created_by
        };

        console.log('Inserting temporary booking...');
        const insertRes = await supabase
            .from('consultas_agendamentos')
            .insert([tempBooking])
            .select();

        console.log('Insert response error:', insertRes.error);
        console.log('Insert response data:', insertRes.data);

        if (insertRes.data && insertRes.data.length > 0) {
            const createdId = insertRes.data[0].id;
            console.log(`Created temporary booking with ID: ${createdId}`);

            console.log('Deleting temporary booking...');
            const deleteRes = await supabase
                .from('consultas_agendamentos')
                .delete()
                .eq('id', createdId);

            console.log('Delete response error:', deleteRes.error);
            console.log('Delete response data:', deleteRes.data);

            // Double check if it was actually deleted
            const verifyRes = await supabase
                .from('consultas_agendamentos')
                .select('id')
                .eq('id', createdId);
            
            console.log('Verification check (should find 0 records):', verifyRes.data);
            if (verifyRes.data && verifyRes.data.length > 0) {
                console.error('CRITICAL: Record was NOT deleted! It still exists in the database.');
            } else {
                console.log('SUCCESS: Record was deleted successfully.');
            }
        }
    } else {
        console.log('No bookings found to run update/delete diagnostics.');
    }
}

runDiagnostics();
