import { supabase } from './supabaseClient';
import { ConsultaPaciente, ConsultaProcedimento, ConsultaAgendamento, ConsultaVaga } from '../types';
import { handleSupabaseError } from '../utils/errorUtils';

// --- PACIENTES ---

export const getPacientes = async (): Promise<ConsultaPaciente[]> => {
    try {
        const { data, error } = await supabase
            .from('consultas_pacientes')
            .select('*')
            .order('name', { ascending: true });

        if (error) throw error;
        return data || [];
    } catch (error) {
        const appError = handleSupabaseError(error);
        console.error('[consultasService] getPacientes Error:', appError.message);
        return [];
    }
};

export const getPacienteById = async (id: string): Promise<ConsultaPaciente | null> => {
    try {
        const { data, error } = await supabase
            .from('consultas_pacientes')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        const appError = handleSupabaseError(error);
        console.error('[consultasService] getPacienteById Error:', appError.message);
        return null;
    }
};

export const getPacienteByCpf = async (cpf: string): Promise<ConsultaPaciente | null> => {
    try {
        const { data, error } = await supabase
            .from('consultas_pacientes')
            .select('*')
            .eq('cpf', cpf.replace(/\D/g, ''))
            .maybeSingle();

        if (error) throw error;
        return data;
    } catch (error) {
        const appError = handleSupabaseError(error);
        console.error('[consultasService] getPacienteByCpf Error:', appError.message);
        return null;
    }
};

export const createPaciente = async (paciente: Omit<ConsultaPaciente, 'id' | 'created_at' | 'updated_at'>): Promise<ConsultaPaciente | null> => {
    try {
        const cleanPaciente = {
            ...paciente,
            cpf: paciente.cpf.replace(/\D/g, '') // strip mask
        };

        const { data, error } = await supabase
            .from('consultas_pacientes')
            .insert([cleanPaciente])
            .select()
            .single();

        if (error) throw error;
        return data;
    } catch (error: any) {
        const appError = handleSupabaseError(error);
        console.error('[consultasService] createPaciente Error:', appError.message);
        // Custom message for unique CPF constraint
        if (error.code === '23505') {
            throw new Error('CPF já cadastrado no sistema.');
        }
        throw appError;
    }
};

export const updatePaciente = async (id: string, updates: Partial<ConsultaPaciente>): Promise<ConsultaPaciente | null> => {
    try {
        const cleanUpdates = { ...updates };
        if (updates.cpf) {
            cleanUpdates.cpf = updates.cpf.replace(/\D/g, '');
        }

        const { data, error } = await supabase
            .from('consultas_pacientes')
            .update(cleanUpdates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    } catch (error: any) {
        const appError = handleSupabaseError(error);
        console.error('[consultasService] updatePaciente Error:', appError.message);
        if (error.code === '23505') {
            throw new Error('CPF já cadastrado no sistema.');
        }
        throw appError;
    }
};

export const getPacienteHistory = async (pacienteId: string): Promise<ConsultaAgendamento[]> => {
    try {
        const { data, error } = await supabase
            .from('consultas_agendamentos')
            .select(`
                *,
                procedimento:consultas_procedimentos(*)
            `)
            .eq('patient_id', pacienteId)
            .order('appointment_date', { ascending: false });

        if (error) throw error;
        return data || [];
    } catch (error) {
        const appError = handleSupabaseError(error);
        console.error('[consultasService] getPacienteHistory Error:', appError.message);
        return [];
    }
};

// --- PROCEDIMENTOS ---

export const getProcedimentos = async (onlyActive: boolean = false): Promise<ConsultaProcedimento[]> => {
    try {
        let query = supabase.from('consultas_procedimentos').select('*').order('name', { ascending: true });
        
        if (onlyActive) {
            query = query.eq('status', 'Ativo');
        }

        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    } catch (error) {
        const appError = handleSupabaseError(error);
        console.error('[consultasService] getProcedimentos Error:', appError.message);
        return [];
    }
};

export const createProcedimento = async (procedimento: Omit<ConsultaProcedimento, 'id' | 'created_at' | 'updated_at'>): Promise<ConsultaProcedimento | null> => {
    try {
        const { data, error } = await supabase
            .from('consultas_procedimentos')
            .insert([procedimento])
            .select()
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        const appError = handleSupabaseError(error);
        console.error('[consultasService] createProcedimento Error:', appError.message);
        throw appError;
    }
};

export const updateProcedimento = async (id: string, updates: Partial<ConsultaProcedimento>): Promise<ConsultaProcedimento | null> => {
    try {
        const { data, error } = await supabase
            .from('consultas_procedimentos')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        const appError = handleSupabaseError(error);
        console.error('[consultasService] updateProcedimento Error:', appError.message);
        throw appError;
    }
};

// --- AGENDAMENTOS ---

export interface AgendamentoFilters {
    patientName?: string;
    patientCpf?: string;
    procedimentoId?: string;
    date?: string;
    status?: string;
}

export const getAgendamentos = async (filters?: AgendamentoFilters): Promise<ConsultaAgendamento[]> => {
    try {
        // We select *, paciente:consultas_pacientes(*), procedimento:consultas_procedimentos(*), responsavel:profiles(name)
        let query = supabase
            .from('consultas_agendamentos')
            .select(`
                *,
                paciente:consultas_pacientes(*),
                procedimento:consultas_procedimentos(*),
                responsavel:profiles(name)
            `)
            .order('appointment_date', { ascending: false })
            .order('created_at', { ascending: false });

        const { data, error } = await query;
        if (error) throw error;

        let filtered = data || [];

        // Apply filters in memory/js for easier partial matches on joined columns if needed,
        // or structure properly. Supabase doesn't easily filter on relation fields in standard select
        // unless you use inner joins which filter rows. We can filter in memory for name/cpf
        // since the dataset size is typically manageable for a municipal regulation module.
        if (filters) {
            if (filters.patientName) {
                const search = filters.patientName.toLowerCase();
                filtered = filtered.filter(a => a.paciente?.name.toLowerCase().includes(search));
            }
            if (filters.patientCpf) {
                const search = filters.patientCpf.replace(/\D/g, '');
                filtered = filtered.filter(a => a.paciente?.cpf.includes(search));
            }
            if (filters.procedimentoId) {
                filtered = filtered.filter(a => a.procedimento_id === filters.procedimentoId);
            }
            if (filters.date) {
                filtered = filtered.filter(a => a.appointment_date === filters.date);
            }
            if (filters.status) {
                filtered = filtered.filter(a => a.status === filters.status);
            }
        }

        return filtered;
    } catch (error) {
        const appError = handleSupabaseError(error);
        console.error('[consultasService] getAgendamentos Error:', appError.message);
        return [];
    }
};

export const createAgendamento = async (agendamento: Omit<ConsultaAgendamento, 'id' | 'created_at'>): Promise<ConsultaAgendamento> => {
    try {
        // 1. Conflict Prevention check: check if this patient already has an active booking for this procedure on this day
        if (agendamento.status === 'Agendado') {
            const { data: conflicts, error: conflictErr } = await supabase
                .from('consultas_agendamentos')
                .select('id')
                .eq('patient_id', agendamento.patient_id)
                .eq('procedimento_id', agendamento.procedimento_id)
                .eq('appointment_date', agendamento.appointment_date)
                .eq('status', 'Agendado')
                .limit(1);

            if (conflictErr) throw conflictErr;
            if (conflicts && conflicts.length > 0) {
                throw new Error('Paciente já possui um agendamento ativo para este exame/consulta nesta data.');
            }
        }

        // 2. Insert agendamento. The DB trigger handles decrementing availability & checking bounds
        const { data, error } = await supabase
            .from('consultas_agendamentos')
            .insert([agendamento])
            .select(`
                *,
                paciente:consultas_pacientes(*),
                procedimento:consultas_procedimentos(*),
                responsavel:profiles(name)
            `)
            .single();

        if (error) {
            // Check if it's the trigger error
            if (error.message && error.message.includes('Vagas insuficientes')) {
                throw new Error('Vagas esgotadas para este procedimento.');
            }
            throw error;
        }

        return data;
    } catch (error: any) {
        console.error('[consultasService] createAgendamento Error:', error.message);
        throw error;
    }
};

export const updateAgendamentoStatus = async (id: string, status: ConsultaAgendamento['status']): Promise<ConsultaAgendamento | null> => {
    try {
        const { data, error } = await supabase
            .from('consultas_agendamentos')
            .update({ status })
            .eq('id', id)
            .select(`
                *,
                paciente:consultas_pacientes(*),
                procedimento:consultas_procedimentos(*),
                responsavel:profiles(name)
            `)
            .single();

        if (error) {
            if (error.message && error.message.includes('Vagas insuficientes')) {
                throw new Error('Não há vagas disponíveis para reativar este agendamento.');
            }
            throw error;
        }
        return data;
    } catch (error: any) {
        console.error('[consultasService] updateAgendamentoStatus Error:', error.message);
        throw error;
    }
};

export const updateAgendamentoDateAndStatus = async (
    id: string, 
    date: string, 
    status: ConsultaAgendamento['status']
): Promise<ConsultaAgendamento | null> => {
    try {
        const { data, error } = await supabase
            .from('consultas_agendamentos')
            .update({ 
                appointment_date: date,
                status: status
            })
            .eq('id', id)
            .select(`
                *,
                paciente:consultas_pacientes(*),
                procedimento:consultas_procedimentos(*),
                responsavel:profiles(name)
            `)
            .single();

        if (error) throw error;
        return data;
    } catch (error: any) {
        console.error('[consultasService] updateAgendamentoDateAndStatus Error:', error.message);
        throw error;
    }
};

export const confirmarDataAgendamento = async (id: string, date: string, time?: string): Promise<ConsultaAgendamento | null> => {
    try {
        const updatePayload: any = { 
            appointment_date: date,
            status: 'Agendado'
        };
        if (time) {
            updatePayload.appointment_time = time;
        }
        const { data, error } = await supabase
            .from('consultas_agendamentos')
            .update(updatePayload)
            .eq('id', id)
            .select(`
                *,
                paciente:consultas_pacientes(*),
                procedimento:consultas_procedimentos(*),
                responsavel:profiles(name)
            `)
            .single();

        if (error) throw error;
        return data;
    } catch (error: any) {
        console.error('[consultasService] confirmarDataAgendamento Error:', error.message);
        throw error;
    }
};

export const deleteAgendamento = async (id: string): Promise<boolean> => {
    try {
        const { error, count } = await supabase
            .from('consultas_agendamentos')
            .delete({ count: 'exact' })
            .eq('id', id);

        if (error) throw error;
        if (count === 0) {
            throw new Error('Nenhum registro foi excluído. Verifique se você possui permissões de exclusão ou se o registro existe.');
        }
        return true;
    } catch (error) {
        const appError = handleSupabaseError(error);
        console.error('[consultasService] deleteAgendamento Error:', appError.message);
        throw appError;
    }
};

// --- DASHBOARD / STATS ---

export interface ConsultasDashboardStats {
    totalPatients: number;
    totalBookings: number;
    popularProcedures: { name: string; type: string; count: number }[];
    availableQuantities: { name: string; type: string; available: number }[];
    bookingsByPeriod: { date: string; count: number }[];
}

export const getDashboardStats = async (): Promise<ConsultasDashboardStats> => {
    try {
        // 1. Total Patients
        const { count: totalPatients, error: pError } = await supabase
            .from('consultas_pacientes')
            .select('*', { count: 'exact', head: true });
        if (pError) throw pError;

        // 2. Total Bookings
        const { count: totalBookings, error: bError } = await supabase
            .from('consultas_agendamentos')
            .select('*', { count: 'exact', head: true });
        if (bError) throw bError;

        // 3. Available Quantities (Procedures that are active)
        const { data: procedures, error: prError } = await supabase
            .from('consultas_procedimentos')
            .select('name, type, available_quantity')
            .eq('status', 'Ativo');
        if (prError) throw prError;

        const availableQuantities = (procedures || []).map(p => ({
            name: p.name,
            type: p.type,
            available: p.available_quantity
        })).sort((a, b) => a.available - b.available); // Sort by fewer available first

        // 4. Bookings raw details to compute popularity and period trends
        const { data: bookings, error: bkError } = await supabase
            .from('consultas_agendamentos')
            .select(`
                appointment_date,
                procedimento:consultas_procedimentos(name, type)
            `);
        if (bkError) throw bkError;

        const rawBookings = bookings || [];

        // Popularity ranking
        const popularMap: Record<string, { type: string; count: number }> = {};
        rawBookings.forEach(b => {
            const proc = Array.isArray(b.procedimento) ? b.procedimento[0] : b.procedimento;
            const name = (proc as any)?.name || 'Desconhecido';
            const type = (proc as any)?.type || 'Exame';
            if (!popularMap[name]) {
                popularMap[name] = { type, count: 0 };
            }
            popularMap[name].count += 1;
        });

        const popularProcedures = Object.entries(popularMap)
            .map(([name, data]) => ({
                name,
                type: data.type,
                count: data.count
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5); // top 5

        // Trends (count bookings per day for the last 30 days)
        const trendMap: Record<string, number> = {};
        
        // Initialize last 7 days
        for (let i = 6; i >= 0; i--) {
            const dateStr = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            trendMap[dateStr] = 0;
        }

        rawBookings.forEach(b => {
            const dateStr = b.appointment_date;
            if (dateStr in trendMap) {
                trendMap[dateStr] += 1;
            } else {
                // If it is within range, register it anyway
                const dateDiff = Math.abs(Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24);
                if (dateDiff <= 30) {
                    trendMap[dateStr] = (trendMap[dateStr] || 0) + 1;
                }
            }
        });

        const bookingsByPeriod = Object.entries(trendMap)
            .map(([date, count]) => {
                // Format date to DD/MM
                const [yyyy, mm, dd] = date.split('-');
                return {
                    date: `${dd}/${mm}`,
                    count
                };
            })
            .sort((a, b) => {
                const [aD, aM] = a.date.split('/');
                const [bD, bM] = b.date.split('/');
                return aM.localeCompare(bM) || aD.localeCompare(bD);
            });

        return {
            totalPatients: totalPatients || 0,
            totalBookings: totalBookings || 0,
            popularProcedures,
            availableQuantities,
            bookingsByPeriod
        };
    } catch (error) {
        console.error('[consultasService] getDashboardStats Error:', error);
        return {
            totalPatients: 0,
            totalBookings: 0,
            popularProcedures: [],
            availableQuantities: [],
            bookingsByPeriod: []
        };
    }
};

// --- VAGAS ---

export const getVagas = async (procedimentoId: string): Promise<ConsultaVaga[]> => {
    try {
        const { data, error } = await supabase
            .from('consultas_vagas')
            .select('*')
            .eq('procedimento_id', procedimentoId)
            .order('data', { ascending: true })
            .order('hora', { ascending: true });

        if (error) throw error;
        return data || [];
    } catch (error) {
        const appError = handleSupabaseError(error);
        console.error('[consultasService] getVagas Error:', appError.message);
        return [];
    }
};

export const createVagas = async (vagas: Omit<ConsultaVaga, 'id' | 'created_at' | 'status'>[]): Promise<ConsultaVaga[] | null> => {
    try {
        const { data, error } = await supabase
            .from('consultas_vagas')
            .insert(vagas)
            .select();

        if (error) throw error;
        return data;
    } catch (error) {
        const appError = handleSupabaseError(error);
        console.error('[consultasService] createVagas Error:', appError.message);
        throw appError;
    }
};

export const deleteVaga = async (id: string): Promise<boolean> => {
    try {
        const { error } = await supabase
            .from('consultas_vagas')
            .delete()
            .eq('id', id);

        if (error) throw error;
        return true;
    } catch (error) {
        const appError = handleSupabaseError(error);
        console.error('[consultasService] deleteVaga Error:', appError.message);
        throw appError;
    }
};
