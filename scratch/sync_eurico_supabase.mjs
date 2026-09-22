import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lntphzphyqnscdxyauzj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxudHBoenBoeXFuc2NkeHlhdXpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4NzkzMzksImV4cCI6MjA4MjQ1NTMzOX0.3yCGZx-Wjoqv-FNHaEnlxdFpjjnSl9ynGZzG70yD-Fw';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: orgData, error } = await supabase
    .from('organization_settings')
    .select('ui_config')
    .eq('id', 'global_config')
    .maybeSingle();

  if (error) {
    console.error('Erro ao ler org settings:', error);
    return;
  }

  const currentUiConfig = orgData?.ui_config || {};
  let especialistas = currentUiConfig.consultas_especialistas || [];
  let procEspecialistasMap = currentUiConfig.consultas_proc_especialistas || {};

  console.log('Especialistas atuais:', especialistas);
  console.log('Mapping atual:', procEspecialistasMap);

  // Procura ou cria EURICO ABREU DE OLIVEIRA JÚNIOR
  let eurico = especialistas.find(e => e.nome?.includes('EURICO'));
  if (!eurico) {
    eurico = {
      id: 'esp-eurico-cardiologia',
      nome: 'EURICO ABREU DE OLIVEIRA JÚNIOR',
      especialidade: 'CARDIOLOGIA',
      grupo: 'MÉDICOS',
      status: 'Ativo',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    especialistas.push(eurico);
  }

  // ID do procedimento 0712: 'c9499c64-5888-4a00-9569-f24ae992fd63'
  procEspecialistasMap['c9499c64-5888-4a00-9569-f24ae992fd63'] = eurico.id;

  const { error: updateError } = await supabase
    .from('organization_settings')
    .update({
      ui_config: {
        ...currentUiConfig,
        consultas_especialistas: especialistas,
        consultas_proc_especialistas: procEspecialistasMap
      }
    })
    .eq('id', 'global_config');

  if (updateError) {
    console.error('Erro ao atualizar org settings:', updateError);
  } else {
    console.log('Sucesso! Especialista e mapeamento salvos no Supabase em organization_settings.ui_config!');
  }
}

main().catch(console.error);
