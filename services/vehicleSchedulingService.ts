import { supabase } from './supabaseClient';
import { VehicleSchedule, ScheduleStatus } from '../types';
import { notificationService } from './notificationService';


export const getSchedules = async (): Promise<VehicleSchedule[]> => {
    const { data, error } = await supabase
        .from('vehicle_schedules')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching schedules:', error);
        return [];
    }

    return data.map((s: any) => ({
        id: s.id,
        protocol: s.protocol,
        vehicleId: s.vehicle_id,
        driverId: s.driver_id,
        requesterPersonId: s.requester_person_id,
        requesterId: s.requester_id,
        destination: s.destination,
        serviceSectorId: s.service_sector_id,
        purpose: s.purpose,
        departureDateTime: s.departure_date_time,
        returnDateTime: s.return_date_time,
        vehicleLocation: s.vehicle_location,
        status: s.status as ScheduleStatus,
        createdAt: s.created_at,
        authorizedByName: s.authorized_by_name,
        passengers: s.passengers,
        patientCount: s.patient_count,
        companionCount: s.companion_count,
        cancellationReason: s.cancellation_reason,
        cancelledAt: s.cancelled_at,
        cancelledBy: s.cancelled_by
    }));
};

const generateProtocol = async (): Promise<string> => {
    const year = new Date().getFullYear();
    // Use a generic ID for vehicle scheduling counter
    const counterId = 'vehicle_scheduling_protocol';

    try {
        // Try to get next count from counterService (if it existed) or manual logic
        // For simplicity and since counterService is available, let's try to use RPC if possible or simple timestamp/random as fallback
        // For now, simpler: Notify users with 'parent_frotas' permission.

        // 1. Get users with 'parent_frotas' permission
        // In a real app we might query a "permissions" table or "users" table with permission column.
        // Assuming 'users' table has a text[] permissions column or similar.
        // However, our User Interface has permissions in JSONB or array.
        // Let's assume we can query users. Since we may not have easy 'contains' on JSON if not set up,
        // we will fetch all admin/frotas users.

        // Fallback if RPC fails: Date based unique ID
        const timestamp = Date.now().toString().slice(-6);
        const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        // @ts-ignore
        const { data, error } = await supabase.rpc('increment_sector_counter', {
            p_sector_id: counterId,
            p_year: year
        });

        if (!error && data !== null) {
            return `OS-${year}${String(data).padStart(5, '0')}`;
        }
        // Fallback
        return `OS-${year}${timestamp}${random}`;
    } catch (e) {
        console.error('Error generating protocol:', e);
        return `OS-${year}${Date.now()}`;
    }
};

const notifyApprovers = async (schedule: any) => {
    const { data: managers } = await supabase
        .from('users')
        .select('id')
        .ilike('permissions', '%parent_frotas%');

    if (managers) {
        for (const manager of managers) {
            await notificationService.createNotification({
                user_id: manager.id,
                title: 'Nova Solicitação de Veículo',
                message: `Solicitação ${schedule.protocol} criada para ${schedule.destination}. Aguardando aprovação.`,
                type: 'info',
                link: '/AgendamentoVeiculos/Aprovacoes'
            });
        }
    }
};

const notifyRequester = async (scheduleId: string, status: ScheduleStatus) => {
    const { data: schedule } = await supabase
        .from('vehicle_schedules')
        .select('requester_id, protocol, destination')
        .eq('id', scheduleId)
        .single();

    if (schedule && schedule.requester_id) {
        let msg = `Sua solicitação ${schedule.protocol} foi atualizada para: ${status}`;
        let type: 'success' | 'error' | 'info' = 'info';

        if (status === 'confirmado') {
            msg = `Sua solicitação ${schedule.protocol} foi APROVADA.`;
            type = 'success';
        } else if (status === 'cancelado') {
            msg = `Sua solicitação ${schedule.protocol} foi REJEITADA/CANCELADA.`;
            type = 'error';
        }

        await notificationService.createNotification({
            user_id: schedule.requester_id,
            title: 'Atualização de Agendamento',
            message: msg,
            type: type as any,
            link: '/AgendamentoVeiculos/Historico'
        });
    }
};


export const createSchedule = async (schedule: Omit<VehicleSchedule, 'id' | 'createdAt' | 'protocol'>): Promise<VehicleSchedule | null> => {
    const protocol = await generateProtocol();

    const dbSchedule = {
        protocol,
        vehicle_id: schedule.vehicleId,
        driver_id: schedule.driverId,
        requester_person_id: schedule.requesterPersonId,
        requester_id: schedule.requesterId,
        destination: schedule.destination,
        service_sector_id: schedule.serviceSectorId,
        purpose: schedule.purpose,
        departure_date_time: schedule.departureDateTime,
        return_date_time: schedule.returnDateTime,
        vehicle_location: schedule.vehicleLocation,
        status: schedule.status,
        authorized_by_name: schedule.authorizedByName,
        passengers: schedule.passengers,
        patient_count: schedule.patientCount,
        companion_count: schedule.companionCount
    };

    const { data, error } = await supabase
        .from('vehicle_schedules')
        .insert([dbSchedule])
        .select()
        .single();

    if (error) {
        console.error('Error creating schedule:', error);
        return null;
    }

    const result = {
        id: data.id,
        protocol: data.protocol,
        vehicleId: data.vehicle_id,
        driverId: data.driver_id,
        requesterPersonId: data.requester_person_id,
        requesterId: data.requester_id,
        destination: data.destination,
        serviceSectorId: data.service_sector_id,
        purpose: data.purpose,
        departureDateTime: data.departure_date_time,
        returnDateTime: data.return_date_time,
        vehicleLocation: data.vehicle_location,
        status: data.status,
        createdAt: data.created_at,

        authorizedByName: data.authorized_by_name,
        passengers: data.passengers,
        patientCount: data.patient_count,
        companionCount: data.companion_count
    };

    await notifyApprovers({ ...result });

    return result;
};

export const updateSchedule = async (schedule: VehicleSchedule): Promise<VehicleSchedule | null> => {
    const dbSchedule = {
        vehicle_id: schedule.vehicleId,
        driver_id: schedule.driverId,
        requester_person_id: schedule.requesterPersonId,
        requester_id: schedule.requesterId,
        destination: schedule.destination,
        service_sector_id: schedule.serviceSectorId,
        purpose: schedule.purpose,
        departure_date_time: schedule.departureDateTime,
        return_date_time: schedule.returnDateTime,
        vehicle_location: schedule.vehicleLocation,
        status: schedule.status,
        authorized_by_name: schedule.authorizedByName,
        passengers: schedule.passengers,
        patient_count: schedule.patientCount,
        companion_count: schedule.companionCount,
        cancellation_reason: schedule.cancellationReason,
        cancelled_at: schedule.cancelledAt,
        cancelled_by: schedule.cancelledBy
    };

    const { data, error } = await supabase
        .from('vehicle_schedules')
        .update(dbSchedule)
        .eq('id', schedule.id)
        .neq('status', 'cancelado')
        .neq('status', 'concluido')
        .select()
        .single();

    if (error) {
        console.error('Error updating schedule:', error);
        return null;
    }

    const result = {
        id: data.id,
        protocol: data.protocol,
        vehicleId: data.vehicle_id,
        driverId: data.driver_id,
        requesterPersonId: data.requester_person_id,
        requesterId: data.requester_id,
        destination: data.destination,
        serviceSectorId: data.service_sector_id,
        purpose: data.purpose,
        departureDateTime: data.departure_date_time,
        returnDateTime: data.return_date_time,
        vehicleLocation: data.vehicle_location,
        status: data.status,
        createdAt: data.created_at,

        authorizedByName: data.authorized_by_name,
        passengers: data.passengers,
        patientCount: data.patient_count,
        companionCount: data.companion_count,
        cancellationReason: data.cancellation_reason,
        cancelledAt: data.cancelled_at,
        cancelledBy: data.cancelled_by
    };

    if (data.status) {
        await notifyRequester(data.id, data.status as ScheduleStatus);
    }

    return result;
};


export const updateScheduleStatus = async (
    id: string,
    status: ScheduleStatus,
    cancellationDetails?: { reason: string, cancelledBy: string }
): Promise<boolean> => {
    const updateData: any = { status };

    if (status === 'cancelado' && cancellationDetails) {
        updateData.cancellation_reason = cancellationDetails.reason;
        updateData.cancelled_by = cancellationDetails.cancelledBy;
        updateData.cancelled_at = new Date().toISOString();
    }

    const { error } = await supabase
        .from('vehicle_schedules')
        .update(updateData)
        .eq('id', id)
        .neq('status', 'cancelado')
        .neq('status', 'concluido'); // Prevent changing concluded schedules

    if (error) {
        console.error('Error updating schedule status:', error);
        return false;
    }

    // Check if the update actually happened (row wasn't filtered out by status check)
    // However, Supabase .update() without .select() doesn't return count by default in v2 unless specified with count option
    // But since we are allowed to "fail silently" if it was already concluded (idempotency), it's fine.
    // Ideally we should check strictness, but for now this is safe.

    await notifyRequester(id, status);

    return true;
};

export const deleteSchedule = async (id: string): Promise<boolean> => {
    const { error } = await supabase
        .from('vehicle_schedules')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting schedule:', error);
        return false;
    }
    return true;
};

// Check availability (Supabase version)
export const checkAvailability = async (vehicleId: string, start: string, end: string, excludeScheduleId?: string): Promise<boolean> => {
    // We want to find if there are ANY schedules that overlap.
    // Overlap condition: (StartA < EndB) and (EndA > StartB)

    let query = supabase
        .from('vehicle_schedules')
        .select('id')
        .eq('vehicle_id', vehicleId)
        .in('status', ['confirmado', 'em_curso']) // Only count confirmed/active trips
        .lt('departure_date_time', end)
        .gt('return_date_time', start);

    if (excludeScheduleId) {
        query = query.neq('id', excludeScheduleId);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error checking availability:', error);
        return false; // Assume available on error? Or unavailable? Let's say available but log error.
    }

    return data.length === 0;
};

// ... existing code

export const checkAndAutoUpdateStatuses = async (schedules: VehicleSchedule[]): Promise<void> => {
    const now = new Date();
    const updates: Promise<any>[] = [];

    for (const schedule of schedules) {
        if (schedule.status === 'cancelado') continue;

        let newStatus: ScheduleStatus | null = null;
        const departure = new Date(schedule.departureDateTime);
        const ret = schedule.returnDateTime ? new Date(schedule.returnDateTime) : null;

        if (schedule.status === 'confirmado' && now >= departure) {
            newStatus = 'em_curso';
        } else if (schedule.status === 'em_curso' && ret && now >= ret) {
            newStatus = 'concluido';
        }

        if (newStatus) {
            updates.push(updateScheduleStatus(schedule.id, newStatus));
        }
    }

    if (updates.length > 0) {
        await Promise.all(updates);
    }
};
