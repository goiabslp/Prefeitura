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
        const cleanPaciente: any = {
            ...paciente,
            cpf: paciente.cpf.replace(/\D/g, '') // strip mask
        };

        let { data, error } = await supabase
            .from('consultas_pacientes')
            .insert([cleanPaciente])
            .select()
            .single();

        // Fallback progressivo: se alguma coluna não existir na tabela Supabase,
        // tenta remover as colunas problemáticas uma a uma e re-inserir
        if (error && (error.code === 'PGRST204' || error.message?.includes('column') || error.message?.includes('schema cache'))) {
            console.warn('[consultasService] Coluna(s) ausente(s) no Supabase. Tentando fallback progressivo...', error.message);

            // Lista de colunas opcionais que podem não existir ainda na tabela
            const optionalCols = ['agente_saude', 'sus_number', 'phone'];
            let fallbackPaciente = { ...cleanPaciente };
            let lastError = error;

            for (const col of optionalCols) {
                if (lastError && (lastError.code === 'PGRST204' || lastError.message?.includes('column') || lastError.message?.includes('schema cache'))) {
                    console.warn(`[consultasService] Removendo coluna '${col}' do payload e tentando novamente...`);
                    delete fallbackPaciente[col];

                    const retryRes = await supabase
                        .from('consultas_pacientes')
                        .insert([fallbackPaciente])
                        .select()
                        .single();

                    data = retryRes.data;
                    lastError = retryRes.error;

                    if (!lastError) break; // Inserção bem-sucedida
                }
            }

            error = lastError;
        }

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
        const cleanUpdates: any = { ...updates };
        if (updates.cpf !== undefined) {
            const rawCpf = updates.cpf ? updates.cpf.replace(/\D/g, '') : '';
            cleanUpdates.cpf = rawCpf.length > 0 ? rawCpf : null;
        }

        let { data, error } = await supabase
            .from('consultas_pacientes')
            .update(cleanUpdates)
            .eq('id', id)
            .select()
            .single();

        // Fallback progressivo: se alguma coluna não existir na tabela Supabase
        if (error && (error.code === 'PGRST204' || error.message?.includes('column') || error.message?.includes('schema cache'))) {
            console.warn('[consultasService] Coluna(s) ausente(s) no Supabase (update). Tentando fallback progressivo...', error.message);

            const optionalCols = ['agente_saude', 'sus_number', 'phone', 'neighborhood', 'street', 'birth_date', 'nickname', 'rg'];
            let fallbackUpdates = { ...cleanUpdates };
            let lastError = error;

            for (const col of optionalCols) {
                if (lastError && (lastError.code === 'PGRST204' || lastError.message?.includes('column') || lastError.message?.includes('schema cache'))) {
                    console.warn(`[consultasService] Removendo coluna '${col}' do payload de update e tentando novamente...`);
                    delete fallbackUpdates[col];

                    const retryRes = await supabase
                        .from('consultas_pacientes')
                        .update(fallbackUpdates)
                        .eq('id', id)
                        .select()
                        .single();

                    data = retryRes.data;
                    lastError = retryRes.error;

                    if (!lastError) break;
                }
            }

            error = lastError;
        }

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

export const deletePaciente = async (id: string): Promise<boolean> => {
    try {
        const { error, count } = await supabase
            .from('consultas_pacientes')
            .delete({ count: 'exact' })
            .eq('id', id);

        if (error) throw error;
        if (count === 0) {
            throw new Error('Nenhum registro foi excluído. Verifique se o registro existe.');
        }
        return true;
    } catch (error: any) {
        const appError = handleSupabaseError(error);
        console.error('[consultasService] deletePaciente Error:', appError.message);
        if (error.code === '23503') {
            throw new Error('Não é possível excluir este paciente pois existem agendamentos/consultas vinculados a ele.');
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

export const deleteProcedimento = async (id: string): Promise<boolean> => {
    try {
        const { error, count } = await supabase
            .from('consultas_procedimentos')
            .delete({ count: 'exact' })
            .eq('id', id);

        if (error) throw error;
        if (count === 0) {
            throw new Error('Nenhum registro foi excluído. Verifique se o registro existe.');
        }
        return true;
    } catch (error: any) {
        const appError = handleSupabaseError(error);
        console.error('[consultasService] deleteProcedimento Error:', appError.message);
        if (error.code === '23503') {
            throw new Error('Não é possível excluir este procedimento pois existem vagas ou agendamentos vinculados a ele.');
        }
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

/**
 * Constrói a lista ordenada da fila com as regras estritas de Agendamento Especial:
 * 1. Agendamentos Especiais sempre ficam no topo da fila.
 * 2. Entre os Especiais, é mantida uma sequência ordenada por criação (Especial 1, Especial 2...).
 * 3. Se já existir um Especial para o mesmo procedimento, o novo Especial é inserido imediatamente após o último Especial daquele procedimento.
 *    Caso não exista, é inserido no topo da lista de especiais.
 * 4. Os agendamentos normais/regulares permanecem abaixo de todos os Especiais na ordem relativa de inserção.
 */
export const orderConsultasQueue = (bookings: ConsultaAgendamento[]): ConsultaAgendamento[] => {
    // Ordena cronologicamente por criação para reproduzir o histórico de entradas na fila
    const sortedChronological = [...bookings].sort((a, b) => {
        const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return timeA - timeB;
    });

    const especiais: ConsultaAgendamento[] = [];
    const normais: ConsultaAgendamento[] = [];

    for (const item of sortedChronological) {
        if (item.priority === 'Especial') {
            let lastIndexSameProc = -1;
            for (let i = especiais.length - 1; i >= 0; i--) {
                if (especiais[i].procedimento_id === item.procedimento_id) {
                    lastIndexSameProc = i;
                    break;
                }
            }

            if (lastIndexSameProc !== -1) {
                // Insere imediatamente após o último Especial deste mesmo procedimento
                especiais.splice(lastIndexSameProc + 1, 0, { ...item });
            } else {
                // Primeiro Especial deste procedimento: vai para o topo dos especiais
                especiais.unshift({ ...item });
            }
        } else {
            normais.push({ ...item });
        }
    }

    // Atribui as posições oficiais na fila e a numeração sequencial dos Especiais
    especiais.forEach((item, idx) => {
        item.special_sequence = idx + 1;
        item.queue_position = idx + 1;
    });

    normais.forEach((item, idx) => {
        item.queue_position = especiais.length + idx + 1;
    });

    return [...especiais, ...normais];
};

/**
 * Recalcula a fila completa e persiste as posições oficiais e sequências no banco de dados.
 */
export const recalculateAndPersistQueuePositions = async (): Promise<void> => {
    try {
        const { data: queueItems, error } = await supabase
            .from('consultas_agendamentos')
            .select('id, procedimento_id, priority, status, created_at, solicitation_date')
            .in('status', ['Fila de espera', 'Aguardando Data', 'Solicitado']);

        if (error || !queueItems || queueItems.length === 0) return;

        const ordered = orderConsultasQueue(queueItems as ConsultaAgendamento[]);

        // Atualiza no banco de dados
        await Promise.all(ordered.map(item =>
            supabase
                .from('consultas_agendamentos')
                .update({
                    queue_position: item.queue_position,
                    special_sequence: item.special_sequence || null
                })
                .eq('id', item.id)
        ));
    } catch (err) {
        console.warn('[consultasService] recalculateAndPersistQueuePositions warning:', err);
    }
};

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

        // Garante que a ordem da fila de espera respeite a prioridade Especial e posições calculadas
        const waitlistItems = filtered.filter(a => a.status === 'Fila de espera');
        if (waitlistItems.length > 0) {
            const orderedWaitlist = orderConsultasQueue(waitlistItems);
            const posMap = new Map<string, { queue_position: number; special_sequence?: number }>();
            orderedWaitlist.forEach(item => {
                posMap.set(item.id, {
                    queue_position: item.queue_position || 1,
                    special_sequence: item.special_sequence
                });
            });

            filtered = filtered.map(item => {
                const queueInfo = posMap.get(item.id);
                if (queueInfo) {
                    return {
                        ...item,
                        queue_position: item.queue_position || queueInfo.queue_position,
                        special_sequence: item.special_sequence || queueInfo.special_sequence
                    };
                }
                return item;
            });
        }

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
        if (agendamento.status === 'Agendado' && agendamento.appointment_date) {
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
            if (error.message && error.message.includes('consultas_agendamentos_priority_check')) {
                throw new Error('A tabela do banco de dados ainda não aceita a prioridade "Especial". Por favor, execute o script SQL "add_agendamento_especial_and_queue_position.sql" no editor SQL do Supabase para atualizar a regra de prioridades.');
            }
            throw error;
        }

        // Recalcular e persistir posições da fila após novo agendamento
        await recalculateAndPersistQueuePositions();
        window.dispatchEvent(new CustomEvent('consultas-agendamentos-changed'));

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

export const updateAgendamento = async (
    id: string, 
    updates: Partial<ConsultaAgendamento>
): Promise<ConsultaAgendamento | null> => {
    try {
        const { paciente, procedimento, responsavel, ...cleanUpdates } = updates as any;

        // Tratar strings vazias para NULL em campos de data e hora do Postgres
        if (cleanUpdates.appointment_date === '') cleanUpdates.appointment_date = null;
        if (cleanUpdates.appointment_time === '') cleanUpdates.appointment_time = null;
        if (cleanUpdates.solicitation_date === '') cleanUpdates.solicitation_date = null;
        if (cleanUpdates.cancellation_reason === '') cleanUpdates.cancellation_reason = null;
        if (cleanUpdates.canceled_by === '') cleanUpdates.canceled_by = null;
        if (cleanUpdates.canceled_by_name === '') cleanUpdates.canceled_by_name = null;
        if (cleanUpdates.canceled_at === '') cleanUpdates.canceled_at = null;

        let { data, error } = await supabase
            .from('consultas_agendamentos')
            .update(cleanUpdates)
            .eq('id', id)
            .select(`
                *,
                paciente:consultas_pacientes(*),
                procedimento:consultas_procedimentos(*),
                responsavel:profiles(name)
            `)
            .single();

        // Fallback progressivo: se alguma coluna não existir ou houver mismatch de schema
        if (error && (error.code === 'PGRST204' || error.message?.includes('column') || error.message?.includes('schema cache'))) {
            console.warn('[consultasService] Coluna(s) ausente(s) no Supabase (updateAgendamento). Tentando fallback progressivo...', error.message);

            const optionalCols = ['solicitation_date', 'appointment_time', 'is_retorno', 'cancellation_reason', 'canceled_by', 'canceled_by_name', 'canceled_at'];
            let fallbackUpdates = { ...cleanUpdates };
            let lastError = error;

            for (const col of optionalCols) {
                if (lastError && (lastError.code === 'PGRST204' || lastError.message?.includes('column') || lastError.message?.includes('schema cache'))) {
                    console.warn(`[consultasService] Removendo coluna '${col}' do payload de updateAgendamento e tentando novamente...`);
                    delete fallbackUpdates[col];

                    const retryRes = await supabase
                        .from('consultas_agendamentos')
                        .update(fallbackUpdates)
                        .eq('id', id)
                        .select(`
                            *,
                            paciente:consultas_pacientes(*),
                            procedimento:consultas_procedimentos(*),
                            responsavel:profiles(name)
                        `)
                        .single();

                    data = retryRes.data;
                    lastError = retryRes.error;

                    if (!lastError) break;
                }
            }

            error = lastError;
        }

        if (error) throw error;
        return data;
    } catch (error) {
        const appError = handleSupabaseError(error);
        console.error('[consultasService] updateAgendamento Error:', appError.message);
        throw appError;
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
            available: Math.max(0, p.available_quantity)
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

export const getVagas = async (procedimentoId?: string): Promise<ConsultaVaga[]> => {
    try {
        let query = supabase
            .from('consultas_vagas')
            .select('*')
            .order('data', { ascending: true })
            .order('hora', { ascending: true });

        if (procedimentoId) {
            query = query.eq('procedimento_id', procedimentoId);
        }

        const { data, error } = await query;

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

        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('consultas-vagas-changed'));
            window.dispatchEvent(new CustomEvent('consultas-procedimentos-changed'));
        }

        return data;
    } catch (error) {
        const appError = handleSupabaseError(error);
        console.error('[consultasService] createVagas Error:', appError.message);
        throw appError;
    }
};

export const updateVaga = async (id: string, updates: Partial<ConsultaVaga>): Promise<ConsultaVaga | null> => {
    try {
        const { data, error } = await supabase
            .from('consultas_vagas')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('consultas-vagas-changed'));
            window.dispatchEvent(new CustomEvent('consultas-procedimentos-changed'));
        }

        return data;
    } catch (error) {
        const appError = handleSupabaseError(error);
        console.error('[consultasService] updateVaga Error:', appError.message);
        throw appError;
    }
};

export const pauseVaga = async (id: string): Promise<boolean> => {
    try {
        const { error } = await supabase
            .from('consultas_vagas')
            .update({ status: 'Pausada' })
            .eq('id', id);

        if (error) throw error;

        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('consultas-vagas-changed'));
            window.dispatchEvent(new CustomEvent('consultas-procedimentos-changed'));
        }

        return true;
    } catch (error) {
        const appError = handleSupabaseError(error);
        console.error('[consultasService] pauseVaga Error:', appError.message);
        throw appError;
    }
};

export const unpauseVaga = async (id: string): Promise<boolean> => {
    try {
        const { error } = await supabase
            .from('consultas_vagas')
            .update({ status: 'Disponível' })
            .eq('id', id);

        if (error) throw error;

        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('consultas-vagas-changed'));
            window.dispatchEvent(new CustomEvent('consultas-procedimentos-changed'));
        }

        return true;
    } catch (error) {
        const appError = handleSupabaseError(error);
        console.error('[consultasService] unpauseVaga Error:', appError.message);
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

        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('consultas-vagas-changed'));
            window.dispatchEvent(new CustomEvent('consultas-procedimentos-changed'));
        }

        return true;
    } catch (error) {
        const appError = handleSupabaseError(error);
        console.error('[consultasService] deleteVaga Error:', appError.message);
        throw appError;
    }
};

// --- GESTORES DO MÓDULO DE CONSULTAS ---

export const getSystemUsers = async (): Promise<any[]> => {
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .order('name', { ascending: true });

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('[consultasService] getSystemUsers Error:', error);
        return [];
    }
};

export const getConsultasGestores = async (): Promise<string[]> => {
    try {
        const { data, error } = await supabase
            .from('consultas_gestores')
            .select('user_id');

        if (error) {
            const local = localStorage.getItem('consultas_gestores_user_ids');
            return local ? JSON.parse(local) : [];
        }
        return (data || []).map((g: any) => g.user_id);
    } catch (error) {
        const local = localStorage.getItem('consultas_gestores_user_ids');
        return local ? JSON.parse(local) : [];
    }
};

export const isUserGestoresOrAdmin = async (user: { id: string; role?: string }): Promise<boolean> => {
    if (user.role === 'admin') return true;
    const gestores = await getConsultasGestores();
    return gestores.includes(user.id);
};

export const addConsultasGestor = async (userId: string, currentUserId?: string): Promise<boolean> => {
    try {
        await supabase
            .from('consultas_gestores')
            .insert([{ user_id: userId, created_by: currentUserId }]);

        const local = await getConsultasGestores();
        if (!local.includes(userId)) {
            local.push(userId);
            localStorage.setItem('consultas_gestores_user_ids', JSON.stringify(local));
        }
        window.dispatchEvent(new CustomEvent('consultas-gestores-changed'));
        return true;
    } catch (error) {
        const local = await getConsultasGestores();
        if (!local.includes(userId)) {
            local.push(userId);
            localStorage.setItem('consultas_gestores_user_ids', JSON.stringify(local));
        }
        window.dispatchEvent(new CustomEvent('consultas-gestores-changed'));
        return true;
    }
};

export const removeConsultasGestor = async (userId: string): Promise<boolean> => {
    try {
        await supabase
            .from('consultas_gestores')
            .delete()
            .eq('user_id', userId);

        let local = await getConsultasGestores();
        local = local.filter(id => id !== userId);
        localStorage.setItem('consultas_gestores_user_ids', JSON.stringify(local));
        window.dispatchEvent(new CustomEvent('consultas-gestores-changed'));
        return true;
    } catch (error) {
        let local = await getConsultasGestores();
        local = local.filter(id => id !== userId);
        localStorage.setItem('consultas_gestores_user_ids', JSON.stringify(local));
        window.dispatchEvent(new CustomEvent('consultas-gestores-changed'));
        return true;
    }
};

export const cancelAgendamentoWithReason = async (
    id: string,
    reason: string,
    user: { id: string; name: string }
): Promise<ConsultaAgendamento | null> => {
    const now = new Date().toISOString();
    try {
        const { data, error } = await supabase
            .from('consultas_agendamentos')
            .update({
                status: 'Cancelado',
                cancellation_reason: reason,
                canceled_by: user.id,
                canceled_by_name: user.name,
                canceled_at: now
            })
            .eq('id', id)
            .select('*, paciente:consultas_pacientes(*), procedimento:consultas_procedimentos(*)')
            .single();

        if (error) {
            const { data: fallbackData } = await supabase
                .from('consultas_agendamentos')
                .update({ status: 'Cancelado' })
                .eq('id', id)
                .select('*, paciente:consultas_pacientes(*), procedimento:consultas_procedimentos(*)')
                .single();
            window.dispatchEvent(new CustomEvent('consultas-agendamentos-changed'));
            return fallbackData;
        }
        window.dispatchEvent(new CustomEvent('consultas-agendamentos-changed'));
        return data;
    } catch (error) {
        console.error('[consultasService] cancelAgendamentoWithReason Error:', error);
        window.dispatchEvent(new CustomEvent('consultas-agendamentos-changed'));
        return null;
    }
};

export const reagendarAgendamento = async (id: string): Promise<ConsultaAgendamento | null> => {
    try {
        const { data, error } = await supabase
            .from('consultas_agendamentos')
            .update({
                status: 'Fila de espera',
                appointment_date: null,
                appointment_time: null,
                cancellation_reason: null,
                canceled_by: null,
                canceled_by_name: null,
                canceled_at: null
            })
            .eq('id', id)
            .select(`
                *,
                paciente:consultas_pacientes(*),
                procedimento:consultas_procedimentos(*),
                responsavel:profiles(name)
            `)
            .single();

        // Fallback progressivo se colunas opcionais não existirem
        if (error && (error.code === 'PGRST204' || error.message?.includes('column') || error.message?.includes('schema cache'))) {
            const { data: fallbackData, error: fallbackError } = await supabase
                .from('consultas_agendamentos')
                .update({
                    status: 'Fila de espera',
                    appointment_date: null,
                    appointment_time: null
                })
                .eq('id', id)
                .select(`
                    *,
                    paciente:consultas_pacientes(*),
                    procedimento:consultas_procedimentos(*),
                    responsavel:profiles(name)
                `)
                .single();

            if (fallbackError) throw fallbackError;
            window.dispatchEvent(new CustomEvent('consultas-agendamentos-changed'));
            return fallbackData;
        }

        if (error) throw error;
        window.dispatchEvent(new CustomEvent('consultas-agendamentos-changed'));
        return data;
    } catch (error: any) {
        console.error('[consultasService] reagendarAgendamento Error:', error.message);
        throw error;
    }
};

