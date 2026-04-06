import { supabase } from './supabaseClient';
import { Person, Sector } from '../types';
import { safelyParseDate } from '../utils/dateUtils';

/**
 * Service to handle automatic generation of Marketing requests.
 */

const getWeekNumber = (d: Date): number => {
    const date = new Date(d.getTime());
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
    const week1 = new Date(date.getFullYear(), 0, 4);
    return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
};

export const marketingSyncService = {
    /**
     * Synchronizes weekly birthday requests.
     * Should be called when an admin/marketing user access the module.
     */
    syncWeeklyBirthdays: async (userId: string, userName: string) => {
        try {
            const today = new Date();
            const year = today.getFullYear();
            const weekNum = getWeekNumber(today);
            const protocolKey = `BW-${year}-W${weekNum.toString().padStart(2, '0')}`;
            const protocolPrefix = `MKT-AUTO-${protocolKey}`;

            // 1. Check if already exists for this week
            const { data: existing } = await supabase
                .from('marketing_requests')
                .select('id')
                .ilike('protocol', `${protocolPrefix}%`)
                .limit(1);

            if (existing && existing.length > 0) {
                console.log(`[MarketingSync] Birthday request already exists for week ${protocolKey}`);
                return;
            }

            // 2. Calculate week range (Sunday to Saturday)
            const sunday = new Date(today);
            sunday.setDate(today.getDate() - today.getDay());
            sunday.setHours(0, 0, 0, 0);

            const daysOfWeek: { month: number; day: number }[] = [];
            for (let i = 0; i < 7; i++) {
                const d = new Date(sunday);
                d.setDate(sunday.getDate() + i);
                daysOfWeek.push({ month: d.getMonth(), day: d.getDate() });
            }

            // 3. Fetch all persons with birthdays
            const { data: personsData, error: personsError } = await supabase
                .from('persons')
                .select('name, birth_date, sector_id')
                .not('birth_date', 'is', null);

            if (personsError) throw personsError;

            // 4. Fetch sectors for names
            const { data: sectorsData } = await supabase.from('sectors').select('id, name');
            const sectorMap = new Map((sectorsData || []).map(s => [s.id, s.name]));

            // 5. Filter birthday cases
            const birthdayCollaborators = (personsData || []).filter(p => {
                const b = safelyParseDate(p.birth_date);
                if (!b) return false;
                return daysOfWeek.some(d => d.month === b.getMonth() && d.day === b.getDate());
            });

            if (birthdayCollaborators.length === 0) {
                console.log(`[MarketingSync] No birthdays found for week ${protocolKey}`);
                return;
            }

            console.log(`[MarketingSync] Found ${birthdayCollaborators.length} birthdays. Generating request...`);

            // 6. Prepare content
            const collaboratorsList = birthdayCollaborators
                .map(p => `${p.name} - ${sectorMap.get(p.sector_id) || 'Sem Setor'}`)
                .join('\n');

            const friday = new Date(sunday);
            friday.setDate(sunday.getDate() + 5);
            const fridayISO = friday.toISOString().split('T')[0];

            const description = `**Título do Pedido:** Aniversariante da Semana\n**Data de Início:** ${fridayISO}\n**Data de Fim:** ${fridayISO}\n**Hora de Início:** 12:00\n**Hora de Fim:** 12:00\n\n**Descrição Detalhada:**\nAniversariantes da Semana:\n${collaboratorsList}`;

            // 7. Create Request
            const { data: requestDef, error: reqError } = await supabase
                .from('marketing_requests')
                .insert([{
                    protocol: `${protocolPrefix}-${Math.floor(Math.random() * 1000)}`,
                    requester_name: 'Prefeito',
                    requester_sector: 'Gabinete',
                    description: description,
                    user_id: userId, // The user who triggered the sync (must be admin)
                    status: 'Em Análise',
                    digital_signature: { 
                        enabled: false, 
                        message: "Solicitação automática gerada pelo sistema.",
                        date: new Date().toISOString()
                    }
                }])
                .select()
                .single();

            if (reqError) throw reqError;

            // 8. Create Content Item
            const { error: contentError } = await supabase
                .from('marketing_contents')
                .insert([{
                    request_id: requestDef.id,
                    content_type: 'Imagem',
                    content_sector: 'Gabinete',
                    event_date: fridayISO,
                    event_time: '12:00:00',
                    event_location: 'Divulgação no Instagram e demais redes sociais disponíveis.'
                }]);

            if (contentError) throw contentError;

            console.log(`[MarketingSync] Success! Created request ${requestDef.protocol}`);
            return requestDef;

        } catch (err) {
            console.error('[MarketingSync] Critical Error:', err);
        }
    }
};
