import { supabase } from './supabaseClient';

export interface CalendarEventInvite {
    id?: string;
    event_id: string;
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
}

export const calendarService = {
    async fetchEvents(startDate: string, endDate: string): Promise<CalendarEvent[]> {
        // Fetch events respecting RLS. We also need to fetch their invites and the user profiles for those invites.
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

        if (eventsError) throw eventsError;

        // Map data to flatten the profile name and professional name
        return (eventsData || []).map((evt: any) => ({
            ...evt,
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
        }));
    },

    async fetchPendingInvites(userId: string): Promise<any[]> {
        // Fetch invites for the user that are 'Pendente'
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
    },

    async createEventWithInvites(eventData: Partial<CalendarEvent>, invites: Partial<CalendarEventInvite>[]): Promise<{ success: boolean; id?: string; error?: string }> {
        // Call RPC
        const { data, error } = await supabase.rpc('create_calendar_event', {
            event_data: eventData,
            invites_data: invites
        });

        if (error) return { success: false, error: error.message };
        return data; // Assuming it returns { success, id } or { success, error }
    },

    async updateEvent(eventId: string, eventData: Partial<CalendarEvent>): Promise<boolean> {
        // For simple updates (without modifying all invites deeply right now, keeping it basic for the event itself)
        const { error } = await supabase
            .from('calendar_events')
            .update(eventData)
            .eq('id', eventId);

        if (error) {
            console.error("Error updating event:", error);
            return false;
        }
        return true;
    },

    async deleteEvent(eventId: string): Promise<boolean> {
        const { error } = await supabase
            .from('calendar_events')
            .delete()
            .eq('id', eventId);

        if (error) {
            console.error("Error deleting event:", error);
            return false;
        }
        return true;
    },

    async respondToInvite(inviteId: string, status: 'Aceito' | 'Recusado', reason?: string): Promise<{ success: boolean; error?: string }> {
        const { data, error } = await supabase.rpc('respond_to_event_invite', {
            p_invite_id: inviteId,
            p_status: status,
            p_decline_reason: reason || null
        });

        if (error) return { success: false, error: error.message };
        return data;
    }
};
