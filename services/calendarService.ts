import { supabase } from './supabaseClient';

export interface CalendarEventInvite {
    id?: string;
    event_id?: string;
    user_id: string;
    status: 'Pendente' | 'Aceito' | 'Recusado';
    role: 'Colaborador' | 'Participante';
    decline_reason?: string;
    user_name?: string; // Fetched from profiles
}

export interface CalendarEvent {
    id: string;
    title: string;
    type: string;
    start_date: string;
    end_date: string;
    is_all_day: boolean;
    start_time?: string;
    end_time?: string;
    description?: string;
    created_by?: string;
    created_at?: string;
    professional_id?: string;
    professional_name?: string; // Virtual field for display
    birth_date?: string; // Birth date from person for recurrence
    is_recurring?: boolean;
    google_event_id?: string;
    synced_with_google?: boolean;
    invites?: CalendarEventInvite[];
    sector?: string;
    image_url?: string;
    is_indefinite?: boolean;
    publish_to_news?: boolean;
    materia_data?: {
        manchete?: string;
        subtitulo?: string;
        corpo?: string;
        destaqueFrase?: string;
        categoria?: string;
        imagemUrl?: string;
        aprovada?: boolean;
        status?: 'pendente' | 'aprovada' | 'publicada';
    };
}

const STORAGE_KEY = 'prefeitura_calendar_events_cache';

/**
 * Serializa metadados extras (imagem, setor, indeterminado, publicar jornal, dados da matéria)
 * dentro do campo description para garantir compatibilidade universal no Supabase
 */
export const serializeEventMetadata = (
    description?: string,
    extra?: { 
        sector?: string; 
        image_url?: string; 
        is_indefinite?: boolean; 
        publish_to_news?: boolean;
        materia_data?: {
            manchete?: string;
            subtitulo?: string;
            corpo?: string;
            destaqueFrase?: string;
            categoria?: string;
            imagemUrl?: string;
        };
    }
): string => {
    let cleanDesc = (description || '').replace(/__PREFEITURA_META__[\s\S]*?__END_META__/g, '').trim();
    if (!extra || (!extra.sector && !extra.image_url && !extra.is_indefinite && !extra.publish_to_news && !extra.materia_data)) {
        return cleanDesc;
    }
    const metaJson = JSON.stringify({
        sector: extra.sector,
        image_url: extra.image_url,
        is_indefinite: extra.is_indefinite,
        publish_to_news: extra.publish_to_news,
        materia_data: extra.materia_data
    });
    return `${cleanDesc ? `${cleanDesc}\n\n` : ''}__PREFEITURA_META__${metaJson}__END_META__`;
};

/**
 * Extrai metadados extras embutidos no campo description
 */
export const deserializeEventMetadata = (
    description?: string
): { 
    cleanDescription: string; 
    sector?: string; 
    image_url?: string; 
    is_indefinite?: boolean; 
    publish_to_news?: boolean;
    materia_data?: {
        manchete?: string;
        subtitulo?: string;
        corpo?: string;
        destaqueFrase?: string;
        categoria?: string;
        imagemUrl?: string;
    };
} => {
    if (!description) return { cleanDescription: '' };
    const match = description.match(/__PREFEITURA_META__([\s\S]*?)__END_META__/);
    if (!match) return { cleanDescription: description };
    try {
        const meta = JSON.parse(match[1]);
        const cleanDescription = description.replace(/__PREFEITURA_META__[\s\S]*?__END_META__/g, '').trim();
        return {
            cleanDescription,
            sector: meta.sector,
            image_url: meta.image_url || meta.materia_data?.imagemUrl,
            is_indefinite: meta.is_indefinite,
            publish_to_news: meta.publish_to_news,
            materia_data: meta.materia_data
        };
    } catch {
        return { cleanDescription: description };
    }
};

export const calendarService = {
    async fetchEvents(startDate: string, endDate: string): Promise<CalendarEvent[]> {
        try {
            const { data: eventsData, error: eventsError } = await supabase
                .from('calendar_events')
                .select(`
                    *,
                    professional:persons (
                        name,
                        birth_date
                    ),
                    calendar_event_invites (
                        id, event_id, user_id, status, role, decline_reason,
                        profiles ( name )
                    )
                `)
                .or(`type.eq.Aniversário,type.eq.Feriado Municipal,is_recurring.eq.true,and(start_date.lte.${endDate},end_date.gte.${startDate})`)
                .order('start_date', { ascending: true });

            if (eventsError) {
                console.error('Erro ao buscar eventos no Supabase:', eventsError);
                return [];
            }

            if (eventsData) {
                return eventsData.map((evt: any) => {
                    const meta = deserializeEventMetadata(evt.description);
                    return {
                        ...evt,
                        description: meta.cleanDescription || evt.description,
                        sector: evt.sector || meta.sector,
                        image_url: evt.image_url || meta.image_url,
                        is_indefinite: evt.is_indefinite ?? meta.is_indefinite,
                        publish_to_news: evt.publish_to_news ?? meta.publish_to_news,
                        materia_data: meta.materia_data,
                        professional_name: evt.professional?.name,
                        birth_date: evt.professional?.birth_date,
                        invites: (evt.calendar_event_invites || []).map((inv: any) => ({
                            id: inv.id,
                            event_id: inv.event_id,
                            user_id: inv.user_id,
                            status: inv.status,
                            role: inv.role,
                            decline_reason: inv.decline_reason,
                            user_name: inv.profiles?.name
                        }))
                    };
                }).sort((a: any, b: any) => (a.start_date || '').localeCompare(b.start_date || ''));
            }

            return [];
        } catch (dbErr) {
            console.error('Erro de conexão ao buscar eventos no banco de dados:', dbErr);
            return [];
        }
    },

    async fetchPendingInvites(userId: string): Promise<any[]> {
        try {
            const { data, error } = await supabase
                .from('calendar_event_invites')
                .select(`
                    id, event_id, status, role,
                    calendar_events (*)
                `)
                .eq('user_id', userId)
                .eq('status', 'Pendente');

            if (error) throw error;
            return data || [];
        } catch {
            return [];
        }
    },

    async createEventWithInvites(eventData: Partial<CalendarEvent>, invites: Partial<CalendarEventInvite>[]): Promise<{ success: boolean; id?: string; error?: string }> {
        const isValidUUID = (str?: string) => !!(str && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str));
        const targetId = isValidUUID(eventData.id) ? eventData.id : (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : undefined);
        let savedId = targetId || '';

        const descWithMeta = serializeEventMetadata(eventData.description, {
            sector: eventData.sector,
            image_url: eventData.image_url,
            is_indefinite: eventData.is_indefinite,
            publish_to_news: eventData.publish_to_news,
            materia_data: eventData.materia_data
        });

        // 1. Salva diretamente no banco de dados central (Supabase)
        try {
            const insertPayload: any = {
                title: eventData.title,
                type: eventData.type,
                start_date: eventData.start_date,
                end_date: eventData.end_date || eventData.start_date,
                is_all_day: eventData.is_all_day ?? true,
                start_time: eventData.start_time,
                end_time: eventData.end_time,
                description: descWithMeta,
                created_by: eventData.created_by,
                is_recurring: eventData.is_recurring,
                professional_id: eventData.professional_id,
                sector: eventData.sector,
                image_url: eventData.image_url,
                is_indefinite: eventData.is_indefinite,
                publish_to_news: eventData.publish_to_news
            };
            if (targetId) insertPayload.id = targetId;

            // Tentativa 1: Inserção com colunas completas
            let { data: insData, error: insErr } = await supabase
                .from('calendar_events')
                .insert([insertPayload])
                .select()
                .single();

            // Se falhou por colunas customizadas não migradas, insere com schema padrão (metadados preservados na description)
            if (insErr) {
                const fallbackPayload: any = {
                    title: eventData.title,
                    type: eventData.type,
                    start_date: eventData.start_date,
                    end_date: eventData.end_date || eventData.start_date,
                    is_all_day: eventData.is_all_day ?? true,
                    start_time: eventData.start_time,
                    end_time: eventData.end_time,
                    description: descWithMeta,
                    created_by: eventData.created_by,
                    is_recurring: eventData.is_recurring,
                    professional_id: eventData.professional_id
                };
                if (targetId) fallbackPayload.id = targetId;

                const { data: fallbackData, error: fallbackErr } = await supabase
                    .from('calendar_events')
                    .insert([fallbackPayload])
                    .select()
                    .single();

                if (fallbackErr) {
                    console.error('Erro ao salvar evento no banco de dados:', fallbackErr);
                    throw fallbackErr;
                }

                if (fallbackData?.id) {
                    savedId = fallbackData.id;
                }
            } else if (insData?.id) {
                savedId = insData.id;
            }

            // Inserir convites no banco de dados
            if (invites && invites.length > 0 && savedId) {
                try {
                    await supabase.from('calendar_event_invites').insert(
                        invites.map(inv => ({
                            event_id: savedId,
                            user_id: inv.user_id,
                            role: inv.role || 'Participante',
                            status: 'Pendente'
                        }))
                    );
                } catch (e) {
                    console.warn('Erro ao inserir convites no banco:', e);
                }
            }

            return { success: true, id: savedId };
        } catch (dbErr: any) {
            console.error('Falha ao persistir evento no banco de dados:', dbErr);
            return { success: false, error: dbErr?.message || 'Erro ao persistir evento no banco de dados.' };
        }
    },

    async updateEvent(eventId: string, eventData: Partial<CalendarEvent>): Promise<boolean> {
        const descWithMeta = serializeEventMetadata(eventData.description, {
            sector: eventData.sector,
            image_url: eventData.image_url,
            is_indefinite: eventData.is_indefinite,
            publish_to_news: eventData.publish_to_news,
            materia_data: eventData.materia_data
        });

        try {
            const { error } = await supabase
                .from('calendar_events')
                .update({
                    ...eventData,
                    description: descWithMeta,
                    sector: eventData.sector,
                    image_url: eventData.image_url,
                    is_indefinite: eventData.is_indefinite,
                    publish_to_news: eventData.publish_to_news
                })
                .eq('id', eventId);

            if (error) {
                // Fallback para colunas básicas no banco de dados
                await supabase
                    .from('calendar_events')
                    .update({
                        title: eventData.title,
                        type: eventData.type,
                        start_date: eventData.start_date,
                        end_date: eventData.end_date,
                        is_all_day: eventData.is_all_day,
                        start_time: eventData.start_time,
                        end_time: eventData.end_time,
                        description: descWithMeta,
                        is_recurring: eventData.is_recurring,
                        professional_id: eventData.professional_id
                    })
                    .eq('id', eventId);
            }

            return true;
        } catch (dbErr) {
            console.error('Erro ao atualizar evento no banco de dados:', dbErr);
            return false;
        }
    },

    async deleteEvent(eventId: string): Promise<boolean> {
        try {
            await supabase
                .from('calendar_events')
                .delete()
                .eq('id', eventId);
            return true;
        } catch (dbErr) {
            console.error('Erro ao deletar evento no banco de dados:', dbErr);
            return false;
        }
    },

    async respondToInvite(inviteId: string, status: 'Aceito' | 'Recusado', reason?: string): Promise<{ success: boolean; error?: string }> {
        try {
            const { data, error } = await supabase.rpc('respond_to_event_invite', {
                p_invite_id: inviteId,
                p_status: status,
                p_decline_reason: reason || null
            });

            if (error) return { success: false, error: error.message };
            return data;
        } catch {
            return { success: true };
        }
    }
};
