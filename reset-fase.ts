import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const envFile = fs.readFileSync('.env', 'utf-8');
let supabaseUrl = '';
let supabaseKey = '';

for (const line of envFile.split('\n')) {
  if (line.startsWith('VITE_SUPABASE_URL=')) supabaseUrl = line.split('=')[1].trim();
  if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) supabaseKey = line.split('=')[1].trim();
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function resetPhase() {
  const protocoloToFind = 'LIC-0016/2026';
  console.log(`Buscando processo com protocolo: ${protocoloToFind}`);

  // Fetch the process
  const { data: processes, error: fetchError } = await supabase
    .from('licitacao_processos')
    .select('*')
    .eq('protocolo', protocoloToFind);

  if (fetchError) {
    console.error('Erro ao buscar processo:', fetchError);
    return;
  }

  if (processes && processes.length > 0) {
    const process = processes[0];
    console.log(`Encontrado processo ID: ${process.id}`);

    const { error: updateError } = await supabase
      .from('licitacao_processos')
      .update({ fase: null })
      .eq('id', process.id);
      if (updateError) {
          console.error('Erro ao atualizar fase licitacao_processos:', updateError);
      } else {
          console.log('Fase atualizada com sucesso em licitacao_processos.');
      }
  }

  // Also check orders table for documentSnapshot content
  console.log('Buscando na tabela orders...');
  const { data: allOrders } = await supabase.from('orders').select('*').eq('protocol', protocoloToFind);

  const orderToUpdate = allOrders?.[0];
  if (orderToUpdate) {
      console.log(`Encontrado order ID: ${orderToUpdate.id}`);
      let currentSnapshot = orderToUpdate.documentSnapshot || orderToUpdate.document_snapshot;
      if (currentSnapshot && currentSnapshot.content) {
          if (currentSnapshot.content.fase) {
              currentSnapshot.content.fase = null;
              console.log('Removendo fase do documentSnapshot...');
              const { error: orderUpdateError } = await supabase
                .from('orders')
                .update({ 
                  documentSnapshot: currentSnapshot
                })
                .eq('id', orderToUpdate.id);
                
              if (orderUpdateError) {
                  console.log('Error updating order:', orderUpdateError);
              } else {
                  console.log('Order atualizada com sucesso.');
              }
          } else {
              console.log('A Order não possui fase no content.');
          }
      }
  } else {
      console.log('Nenhuma order encontrada com este protocolo.');
  }
}

resetPhase().catch(console.error);
