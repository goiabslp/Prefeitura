import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

function loadEnv(filepath) {
    if (!fs.existsSync(filepath)) return;
    const content = fs.readFileSync(filepath, 'utf8');
    for (const line of content.split('\n')) {
        const clean = line.trim();
        if (!clean || clean.startsWith('#')) continue;
        const index = clean.indexOf('=');
        if (index === -1) continue;
        const key = clean.substring(0, index).trim();
        const value = clean.substring(index + 1).trim().replace(/^['"]|['"]$/g, '');
        process.env[key] = value;
    }
}
loadEnv('.env.local');
loadEnv('.env');

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function getAllServiceRequestsTest(lightweight = true, page = 0, pageSize = 1000, searchTerm = '') {
    let serviceRequestOrders = [];

    // 1. service_requests
    let query = supabase
        .from('service_requests')
        .select('*')
        .order('created_at', { ascending: false });

    if (lightweight) {
        const from = page * pageSize;
        const to = from + pageSize - 1;
        query = query.range(from, to);
    }

    const { data } = await query;
    serviceRequestOrders = (data || []).map((item) => ({ id: item.id, title: item.title, blockType: 'diarias' }));

    // 2. diarias_eventos
    try {
        let eventosQuery = supabase
            .from('diarias_eventos')
            .select('*')
            .order('created_at', { ascending: false });

        if (searchTerm) {
            eventosQuery = eventosQuery.or(`destino.ilike.%${searchTerm}%,motivo.ilike.%${searchTerm}%,user_name.ilike.%${searchTerm}%`);
        }

        const { data: eventosData } = await eventosQuery;

        if (eventosData && eventosData.length > 0) {
            let deletedSet = new Set();

            eventosData.forEach((evt) => {
                if (deletedSet.has(String(evt.id))) return;
                if (serviceRequestOrders.some(o => String(o.id) === String(evt.id))) return;

                const requesterNames = evt.pessoas && Array.isArray(evt.pessoas) && evt.pessoas.length > 0
                    ? evt.pessoas.map((p) => p.name).join(', ')
                    : evt.user_name || 'Servidor não informado';

                serviceRequestOrders.push({
                    id: evt.id,
                    protocol: `EVT-${String(evt.id).slice(0, 6).toUpperCase()}`,
                    title: `Viagem Oficial: ${evt.destino}`,
                    status: evt.status,
                    createdAt: evt.created_at,
                    userId: evt.user_id,
                    userName: requesterNames,
                    blockType: 'diarias'
                });
            });
        }
    } catch (e) {
        console.warn('Erro ao carregar diarias_eventos no historico:', e);
    }

    return serviceRequestOrders;
}

async function test() {
    const res = await getAllServiceRequestsTest(true, 0, 15, '');
    console.log('Resulting orders count:', res.length);
    console.log('First 3 orders:', res.slice(0, 3));
}
test();
