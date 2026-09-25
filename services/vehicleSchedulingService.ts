import { supabase } from './supabaseClient';
import { VehicleSchedule, ScheduleStatus } from '../types';
import { notificationService } from './notificationService';
import { validateDriverScheduleRules, fetchSystemHolidaysFromDatabase } from './driverRestRulesService';

const mapSchedule = (s: any): VehicleSchedule => ({
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
});

const SCHEDULE_COLUMNS = 'id, protocol, vehicle_id, driver_id, requester_person_id, requester_id, destination, service_sector_id, purpose, departure_date_time, return_date_time, vehicle_location, status, created_at, authorized_by_name, passengers, patient_count, companion_count, cancellation_reason, cancelled_at, cancelled_by';

export const getSchedules = async (): Promise<VehicleSchedule[]> => {
    const { data, error } = await supabase
        .from('vehicle_schedules')
        .select(SCHEDULE_COLUMNS)
        .order('created_at', { ascending: false })
        .limit(300);

    if (error) {
        console.error('Error fetching schedules:', error);
        throw error;
    }

    return (data || []).map(mapSchedule);
};

export const getScheduleById = async (id: string): Promise<VehicleSchedule | null> => {
    const { data, error } = await supabase
        .from('vehicle_schedules')
        .select(SCHEDULE_COLUMNS)
        .eq('id', id)
        .single();

    if (error) {
        console.error('Error fetching schedule:', error);
        throw error;
    }

    return data ? mapSchedule(data) : null;
};

const generateProtocol = async (): Promise<string> => {
    const year = new Date().getFullYear();
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `OS-${year}${timestamp}${random}`;
};

const notifyApprovers = async (schedule: any) => {
    const { data: managers } = await supabase
        .from('profiles')
        .select('id')
        .contains('permissions', ['parent_frotas']);

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
    // Validação Definitiva no Backend: Regras de Descanso e Disponibilidade do Motorista
    if (schedule.driverId && schedule.departureDateTime && schedule.returnDateTime) {
        const existingSchedules = await getSchedules();
        const holidays = await fetchSystemHolidaysFromDatabase();
        const validation = validateDriverScheduleRules({
            driverId: schedule.driverId,
            departureDateTime: schedule.departureDateTime,
            returnDateTime: schedule.returnDateTime,
            allSchedules: existingSchedules,
            customHolidays: holidays
        });

        if (!validation.isValid) {
            console.error('Tentativa de agendamento bloqueada por regra de descanso:', validation);
            throw new Error(validation.message || 'Motorista indisponível pelas regras de descanso.');
        }
    }

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
        throw error;
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
    // Validação Definitiva no Backend: Regras de Descanso e Disponibilidade do Motorista
    if (schedule.driverId && schedule.departureDateTime && schedule.returnDateTime && schedule.status !== 'cancelado') {
        const existingSchedules = await getSchedules();
        const holidays = await fetchSystemHolidaysFromDatabase();
        const validation = validateDriverScheduleRules({
            driverId: schedule.driverId,
            departureDateTime: schedule.departureDateTime,
            returnDateTime: schedule.returnDateTime,
            allSchedules: existingSchedules,
            customHolidays: holidays,
            excludeScheduleId: schedule.id
        });

        if (!validation.isValid) {
            console.error('Tentativa de atualização bloqueada por regra de descanso:', validation);
            throw new Error(validation.message || 'Motorista indisponível pelas regras de descanso.');
        }
    }

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
        .select()
        .maybeSingle();

    if (error) {
        console.error('Error updating schedule:', error);
        throw error;
    }

    if (!data) {
        // Se a linha não retornou via update, tenta buscar o registro atual
        const existing = await getScheduleById(schedule.id);
        if (existing) return existing;
        return schedule;
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
    // Validação ao aprovar agendamento
    if (status === 'confirmado') {
        const current = await getScheduleById(id);
        if (current && current.driverId && current.departureDateTime && current.returnDateTime) {
            const existingSchedules = await getSchedules();
            const holidays = await fetchSystemHolidaysFromDatabase();
            const validation = validateDriverScheduleRules({
                driverId: current.driverId,
                departureDateTime: current.departureDateTime,
                returnDateTime: current.returnDateTime,
                allSchedules: existingSchedules,
                customHolidays: holidays,
                excludeScheduleId: id
            });

            if (!validation.isValid) {
                console.error('Tentativa de aprovação bloqueada por regra de descanso:', validation);
                throw new Error(validation.message || 'Aprovação bloqueada: Motorista indisponível pelas regras de descanso.');
            }
        }
    }

    const updateData: any = { status };

    if (status === 'cancelado' && cancellationDetails) {
        updateData.cancellation_reason = cancellationDetails.reason;
        updateData.cancelled_by = cancellationDetails.cancelledBy;
        updateData.cancelled_at = new Date().toISOString();
    }

    const { error } = await supabase
        .from('vehicle_schedules')
        .update(updateData)
        .eq('id', id);

    if (error) {
        console.error('Error updating schedule status:', error);
        throw error;
    }

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
        throw error;
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
        .not('status', 'in', '("cancelado","rejeitado")')
        .lt('departure_date_time', end)
        .gt('return_date_time', start);

    if (excludeScheduleId) {
        query = query.neq('id', excludeScheduleId);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error checking availability:', error);
        throw error;
    }

    return (data || []).length === 0;
};

// ... existing code

export const checkAndAutoUpdateStatuses = async (schedules: VehicleSchedule[]): Promise<void> => {
    try {
        const now = new Date();
        const updates: Promise<any>[] = [];

        for (const schedule of schedules) {
            if (!schedule?.id || schedule.status === 'cancelado' || schedule.status === 'concluido') continue;

            let newStatus: ScheduleStatus | null = null;
            const departure = new Date(schedule.departureDateTime);
            const ret = schedule.returnDateTime ? new Date(schedule.returnDateTime) : null;

            if (now > departure) {
                if (schedule.status === 'pendente') {
                    newStatus = 'cancelado';
                } else if (schedule.status === 'confirmado') {
                    newStatus = 'em_curso';
                } else if (schedule.status === 'em_curso' && ret && now >= ret) {
                    newStatus = 'concluido';
                }
            } else if (schedule.status === 'em_curso' && ret && now >= ret) {
                newStatus = 'concluido';
            }

            if (newStatus) {
                if (newStatus === 'cancelado') {
                    updates.push(updateScheduleStatus(schedule.id, newStatus, {
                        reason: 'Cancelado automaticamente: Data de saída expirada (anterior à data atual).',
                        cancelledBy: 'Sistema'
                    }).catch(e => console.warn('Erro ao auto-cancelar agendamento expirado:', e)));
                } else {
                    updates.push(updateScheduleStatus(schedule.id, newStatus).catch(e => console.warn('Erro ao auto-atualizar status de agendamento:', e)));
                }
            }
        }

        if (updates.length > 0) {
            await Promise.all(updates);
        }
    } catch (err) {
        console.error('Erro na verificação automática de status de agendamentos:', err);
    }
};
