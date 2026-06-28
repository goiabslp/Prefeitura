import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Função para ler o .env manualmente
const envFile = fs.readFileSync('./.env', 'utf-8');
const envVars = {};
envFile.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
        envVars[match[1]] = match[2];
    }
});

const supabaseUrl = envVars['VITE_SUPABASE_URL'];
const supabaseKey = envVars['VITE_SUPABASE_ANON_KEY'];
const supabase = createClient(supabaseUrl, supabaseKey);

const data = fs.readFileSync('./meds.txt', 'utf-8');
const lines = data.split('\n').filter(line => line.trim().length > 0);

const capitalize = (str) => {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

const mapCategoria = (cat) => {
    if (cat.includes('CBAF')) return 'CBAF';
    if (cat.includes('CEAF')) return 'CEAF';
    if (cat.includes('CESAF')) return 'CESAF';
    return 'CBAF';
}

const medsToInsert = lines.map(line => {
    const parts = line.split('|').map(p => p.trim());
    if (parts.length >= 4) {
        let nome = parts[0];
        let forma = capitalize(parts[1]);
        let dosagemRaw = parts[2];
        let categoria = mapCategoria(parts[3]);

        let dosagem = dosagemRaw === "'-" || dosagemRaw === "-" ? "" : dosagemRaw;

        return {
            nome: nome.toUpperCase(),
            tipo: forma,
            dosagem: dosagem,
            categoria: categoria,
            principio_ativo: nome.toUpperCase(),
            quantidade: 0,
            unidade: 'un',
            limite_minimo: 10
            // omitindo validade, lote, fornecedor para deixar como null/default
        };
    }
    return null;
}).filter(m => m !== null);

async function run() {
    console.log(`Preparando para inserir ${medsToInsert.length} medicamentos...`);
    
    const batchSize = 100;
    for (let i = 0; i < medsToInsert.length; i += batchSize) {
        const batch = medsToInsert.slice(i, i + batchSize);
        console.log(`Inserindo lote ${i / batchSize + 1} (${batch.length} itens)...`);
        const { error } = await supabase.from('farmacia_medicamentos').insert(batch);
        if (error) {
            console.error('Erro no lote:', error);
        }
    }
    console.log('Finalizado!');
}

run();
