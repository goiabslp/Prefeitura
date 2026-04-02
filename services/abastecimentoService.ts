import { supabase } from './supabaseClient';
import { handleSupabaseError } from '../utils/errorUtils';

export interface FuelConfig {
    diesel: number;
    gasolina: number;
    etanol: number;
    arla: number;
}

export interface AbastecimentoRecord {
    id: string;
    protocol?: string;
    fiscal: string;
    date: string;
    vehicle: string; // "Model - Brand" or just string? The DB stores string.
    driver: string;
    fuelType: string;
    liters: number;
    odometer: number;
    cost: number;
    station?: string;
    invoiceNumber?: string;
    userId?: string;
    userName?: string;
    sectorId?: string;
    payment_status?: string;
    unit_price?: number;
    created_at?: string;
}

export interface AbastecimentoReportHistory {
    id: string;
    created_at: string;
    report_type: 'simplified' | 'complete' | 'listagem';
    start_date?: string;
    end_date?: string;
    station?: string;
    sector?: string;
    vehicle?: string;
    fuel_type?: string;
    payment_status: string;
    user_id?: string;
    user_name?: string;
    record_ids?: string[];
}

export interface GasStation {
    id: string;
    name: string;
    cnpj: string;
    city: string;
    fuel_prices?: FuelConfig;
}

export interface ScheduledPriceUpdate {
    id?: string;
    station_id: string;
    prices: FuelConfig;
    scheduled_date: string;
    applied?: boolean;
    created_at?: string;
}

const DEFAULT_CONFIG: FuelConfig = {
    diesel: 0,
    gasolina: 0,
    etanol: 0,
    arla: 0
};

export const AbastecimentoService = {
    getFuelConfig: async (): Promise<FuelConfig> => {
        try {
            const { data, error } = await supabase
                .from('abastecimento_config')
                .select('value')
                .eq('key', 'fuel_prices')
                .single();

            if (error) {
                if (error.code === 'PGRST116') return DEFAULT_CONFIG;
                console.error('Error loading fuel config:', error);
                return DEFAULT_CONFIG;
            }
            return data?.value || DEFAULT_CONFIG;
        } catch (error) {
            console.error('Error loading fuel config:', error);
            return DEFAULT_CONFIG;
        }
    },

    saveFuelConfig: async (config: FuelConfig): Promise<void> => {
        try {
            const { error } = await supabase
                .from('abastecimento_config')
                .upsert({ key: 'fuel_prices', value: config }, { onConflict: 'key' });

            if (error) throw error;
        } catch (error) {
            console.error('Error saving fuel config:', error);
        }
    },

    getFuelTypes: async (): Promise<{ key: keyof FuelConfig; label: string; price: number }[]> => {
        const config = await AbastecimentoService.getFuelConfig();
        return [
            { key: 'diesel', label: 'Diesel', price: config.diesel },
            { key: 'gasolina', label: 'Gasolina', price: config.gasolina },
            { key: 'etanol', label: 'Etanol', price: config.etanol },
            { key: 'arla', label: 'Arla', price: config.arla }
        ];
    },

    getAbastecimentos: async (
        page: number = 1,
        limit: number = 50,
        filters?: {
            search?: string;
            date?: string;
            startDate?: string;
            endDate?: string;
            station?: string;
            sector?: string;
            vehicle?: string;
            fuelType?: string;
            paymentStatus?: string;
        }
    ): Promise<{ data: AbastecimentoRecord[], count: number }> => {
        try {
            let query = supabase
                .from('abastecimentos')
                .select('*', { count: 'exact' });

            if (filters) {
                if (filters.search) {
                    const s = filters.search.toLowerCase();
                    query = query.or(`vehicle.ilike.%${s}%,driver.ilike.%${s}%,fiscal.ilike.%${s}%,invoice_number.ilike.%${s}%`);
                }
                if (filters.date) {
                    const start = `${filters.date}T00:00:00-03:00`;
                    const end = `${filters.date}T23:59:59-03:00`;
                    query = query.gte('date', start).lte('date', end);
                }
                if (filters.startDate) {
                    const val = filters.startDate.includes('T') ? filters.startDate : `${filters.startDate}T00:00:00-03:00`;
                    query = query.gte('date', val);
                }
                if (filters.endDate) {
                    const val = filters.endDate.includes('T') ? filters.endDate : `${filters.endDate}T23:59:59-03:00`;
                    query = query.lte('date', val);
                }
                if (filters.station && filters.station !== 'all') {
                    query = query.eq('station', filters.station);
                }
                if (filters.vehicle && filters.vehicle !== 'all') {
                    query = query.eq('vehicle', filters.vehicle);
                }
                if (filters.fuelType && filters.fuelType !== 'all') {
                    query = query.ilike('fuel_type', `%${filters.fuelType}%`);
                }
                if (filters.paymentStatus && filters.paymentStatus !== 'all') {
                    query = query.eq('payment_status', filters.paymentStatus);
                }
                if (filters.sector && filters.sector !== 'all') {
                    const { data: sectorVehicles, error: secError } = await supabase
                        .from('vehicles')
                        .select('plate, model, brand')
                        .eq('sector_id', filters.sector);

                    if (secError) throw secError;

                    if (sectorVehicles && sectorVehicles.length > 0) {
                        const identifiers = sectorVehicles.flatMap(v => {
                            const params = [];
                            if (v.plate) params.push(v.plate);
                            params.push(`${v.model} - ${v.brand}`);
                            return params;
                        });
                        query = query.in('vehicle', identifiers);
                    } else {
                        return { data: [], count: 0 };
                    }
                }
            }

            const from = (page - 1) * limit;
            const to = from + limit - 1;

            const { data, error, count } = await query
                .order('date', { ascending: false })
                .range(from, to);

            if (error) throw error;

            const mappedData = data?.map((item: any) => ({
                id: item.id,
                protocol: item.protocol,
                fiscal: item.fiscal,
                date: item.date,
                vehicle: item.vehicle,
                driver: item.driver,
                fuelType: item.fuel_type,
                liters: item.liters,
                odometer: item.odometer,
                cost: item.cost,
                station: item.station,
                invoiceNumber: item.invoice_number,
                userId: item.user_id,
                userName: item.user_name,
                sectorId: item.sector_id,
                payment_status: item.payment_status,
                unit_price: item.unit_price,
                created_at: item.created_at
            })) || [];

            return { data: mappedData, count: count || 0 };
        } catch (error) {
            const appError = handleSupabaseError(error);
            console.error('[AbastecimentoService] getAbastecimentos Error:', appError.message);
            return { data: [], count: 0 };
        }
    },

    getReportHistory: async (): Promise<AbastecimentoReportHistory[]> => {
        try {
            const { data, error } = await supabase
                .from('abastecimento_reports_history')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('[AbastecimentoService] getReportHistory Error:', error);
            return [];
        }
    },

    saveReportHistory: async (report: Partial<AbastecimentoReportHistory>): Promise<AbastecimentoReportHistory | null> => {
        try {
            // Check for existing identical report
            let query = supabase
                .from('abastecimento_reports_history')
                .select('id')
                .eq('report_type', report.report_type);

            if (report.start_date) query = query.eq('start_date', report.start_date);
            else query = query.is('start_date', null);

            if (report.end_date) query = query.eq('end_date', report.end_date);
            else query = query.is('end_date', null);

            if (report.station) query = query.eq('station', report.station);
            else query = query.is('station', null);

            if (report.sector) query = query.eq('sector', report.sector);
            else query = query.is('sector', null);

            if (report.vehicle) query = query.eq('vehicle', report.vehicle);
            else query = query.is('vehicle', null);

            if (report.fuel_type) query = query.eq('fuel_type', report.fuel_type);
            else query = query.is('fuel_type', null);

            const { data: existing } = await query;

            if (existing && existing.length > 0) {
                // Report with same filters already exists, do not duplicate
                return null;
            }

            const { data, error } = await supabase
                .from('abastecimento_reports_history')
                .insert([report])
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('[AbastecimentoService] saveReportHistory Error:', error);
            return null;
        }
    },

    updateReportPaymentStatus: async (reportId: string, newStatus: string, recordIds: string[]): Promise<void> => {
        try {
            // Update the report payment status
            const { error: reportError } = await supabase
                .from('abastecimento_reports_history')
                .update({ payment_status: newStatus })
                .eq('id', reportId);

            if (reportError) throw reportError;

            // Cascade the update to the associated abastecimento records
            if (recordIds && recordIds.length > 0) {
                const { error: recordsError } = await supabase
                    .from('abastecimentos')
                    .update({ payment_status: newStatus })
                    .in('id', recordIds);

                if (recordsError) throw recordsError;
            }

        } catch (error) {
            console.error('[AbastecimentoService] updateReportPaymentStatus Error:', error);
            throw error;
        }
    },

    checkInvoiceExists: async (invoiceNumber: string, station: string, excludeId?: string): Promise<boolean> => {
        try {
            let query = supabase
                .from('abastecimentos')
                .select('id')
                .eq('invoice_number', invoiceNumber)
                .eq('station', station);

            if (excludeId) {
                query = query.neq('id', excludeId);
            }

            const { data, error } = await query;

            if (error) throw error;
            return !!(data && data.length > 0);
        } catch (error) {
            const appError = handleSupabaseError(error);
            console.error('[AbastecimentoService] checkInvoiceExists Error:', appError.message);
            return false;
        }
    },

    saveAbastecimento: async (record: AbastecimentoRecord, isEdit: boolean = false, overrideOdometerValidation: boolean = false): Promise<void> => {
        try {
            // Backend validation: check if odometer is less than or equal to the latest recorded
            // Only validate if NOT editing and NOT a legacy update (which we can check by record.id existence, but isEdit is more explicit)
            if (!isEdit && !overrideOdometerValidation) {
                const latestOdometer = await AbastecimentoService.getLatestOdometerByVehicle(record.vehicle);
                if (latestOdometer !== null && record.odometer <= latestOdometer) {
                    throw new Error(`BLOQUEIO: O Horímetro/Odômetro informado (${record.odometer.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}) é menor ou igual ao último registro (${latestOdometer.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}). O cadastro não pode ser realizado.`);
                }
            }

            // [NEW] Robustness: Backend ID/Record Existence Validation
            if (!isEdit) {
                // 1. Validate Vehicle
                const { data: vData } = await supabase.from('vehicles').select('id').eq('plate', record.vehicle).maybeSingle();
                if (!vData) throw new Error(`ERRO: Veículo "${record.vehicle}" não encontrado no banco de dados. Carregue a página e tente novamente.`);

                // 2. Validate Driver
                const { data: pData } = await supabase.from('persons').select('id').eq('name', record.driver).maybeSingle();
                if (!pData) throw new Error(`ERRO: Motorista "${record.driver}" não encontrado no banco de dados.`);

                // 3. Validate Fuel Type (Simplified check against config or active label)
                // Since fuelType stores "type - R$ price", we check the prefix
                const fuelTypePrefix = record.fuelType.split(' - ')[0];
                const config = await AbastecimentoService.getFuelConfig();
                const validTypes = ['diesel', 'gasolina', 'etanol', 'arla', 'Gás']; // Match fuelTypes labels or keys
                const isValidFuel = validTypes.some(t => fuelTypePrefix.toLowerCase().includes(t.toLowerCase()));
                if (!isValidFuel) throw new Error(`ERRO: Tipo de combustível "${fuelTypePrefix}" é inválido.`);
            }

            if (isEdit) {
                // Fetch existing record to preserve protected fields
                const { data: existing, error: fetchError } = await supabase
                    .from('abastecimentos')
                    .select('station, invoice_number')
                    .eq('id', record.id)
                    .single();

                if (!fetchError && existing) {
                    record.station = existing.station;
                    record.invoiceNumber = existing.invoice_number;
                }
            }

            const dbRecord = {
                id: record.id,
                protocol: record.protocol,
                date: record.date,
                vehicle: record.vehicle,
                driver: record.driver,
                fuel_type: record.fuelType,
                liters: record.liters,
                odometer: record.odometer,
                cost: record.cost,
                station: record.station,
                invoice_number: record.invoiceNumber,
                fiscal: record.fiscal,
                user_id: record.userId,
                user_name: record.userName,
                sector_id: record.sectorId,
                payment_status: record.payment_status || 'Em Aberto',
                unit_price: record.unit_price
            };

            const { error } = await supabase
                .from('abastecimentos')
                .upsert(dbRecord);

            if (error) throw error;
        } catch (error) {
            const appError = error instanceof Error ? error : handleSupabaseError(error);
            console.error('[AbastecimentoService] saveAbastecimento Error:', appError.message);
            throw appError;
        }
    },

    deleteAbastecimento: async (id: string): Promise<void> => {
        try {
            const { error } = await supabase
                .from('abastecimentos')
                .delete()
                .eq('id', id);

            if (error) throw error;
        } catch (error) {
            const appError = handleSupabaseError(error);
            console.error('[AbastecimentoService] deleteAbastecimento Error:', appError.message);
            throw appError;
        }
    },

    getGasStations: async (): Promise<GasStation[]> => {
        try {
            const { data, error } = await supabase
                .from('abastecimento_gas_stations')
                .select('*')
                .order('name', { ascending: true });

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error loading gas stations:', error);
            return [];
        }
    },

    saveGasStation: async (station: GasStation): Promise<void> => {
        try {
            const { error } = await supabase
                .from('abastecimento_gas_stations')
                .upsert(station);

            if (error) throw error;
        } catch (error) {
            console.error('Error saving gas station:', error);
            throw error;
        }
    },

    updateStationFuelPrices: async (stationId: string, prices: FuelConfig): Promise<void> => {
        try {
            const { error } = await supabase
                .from('abastecimento_gas_stations')
                .update({ fuel_prices: prices })
                .eq('id', stationId);

            if (error) throw error;
        } catch (error) {
            console.error('Error updating station fuel prices:', error);
            throw error;
        }
    },

    deleteGasStation: async (id: string): Promise<void> => {
        try {
            const { error } = await supabase
                .from('abastecimento_gas_stations')
                .delete()
                .eq('id', id);

            if (error) throw error;
        } catch (error) {
            console.error('Error deleting gas station:', error);
        }
    },

    getLatestOdometerByVehicle: async (vehiclePlate: string): Promise<number | null> => {
        try {
            const { data, error } = await supabase
                .from('abastecimentos')
                .select('odometer')
                .eq('vehicle', vehiclePlate)
                .order('date', { ascending: false })
                .limit(1)
                .single();

            if (error) {
                if (error.code !== 'PGRST116') console.error('Error fetching latest odometer:', error);
                return null;
            }
            return data?.odometer || null;
        } catch (error) {
            console.error('Error fetching latest odometer:', error);
            return null;
        }
    },

    getAllLatestOdometers: async (): Promise<Record<string, number>> => {
        try {
            const { data, error } = await supabase
                .from('abastecimentos')
                .select('vehicle, odometer, date')
                .order('date', { ascending: false });

            if (error) {
                console.error('Error fetching all latest odometers:', error);
                return {};
            }

            const latest: Record<string, number> = {};
            data?.forEach(row => {
                if (!latest[row.vehicle]) {
                    latest[row.vehicle] = row.odometer;
                }
            });
            return latest;
        } catch (error) {
            console.error('Error fetching all latest odometers:', error);
            return {};
        }
    },

    getScheduledPrices: async (stationId?: string): Promise<ScheduledPriceUpdate[]> => {
        try {
            let query = supabase
                .from('abastecimento_scheduled_prices')
                .select('*')
                .order('scheduled_date', { ascending: true });

            if (stationId) {
                query = query.eq('station_id', stationId);
            }

            const { data, error } = await query;
            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error loading scheduled prices:', error);
            return [];
        }
    },

    saveScheduledPrice: async (update: ScheduledPriceUpdate): Promise<void> => {
        try {
            const { error } = await supabase
                .from('abastecimento_scheduled_prices')
                .upsert(update);
            if (error) throw error;
        } catch (error) {
            console.error('Error saving scheduled price:', error);
            throw error;
        }
    },

    deleteScheduledPrice: async (id: string): Promise<void> => {
        try {
            const { error } = await supabase
                .from('abastecimento_scheduled_prices')
                .delete()
                .eq('id', id);
            if (error) throw error;
        } catch (error) {
            console.error('Error deleting scheduled price:', error);
            throw error;
        }
    },

    applyPendingPriceUpdates: async (): Promise<void> => {
        try {
            const { error } = await supabase.rpc('apply_scheduled_fuel_prices');
            if (error) throw error;
        } catch (error) {
            console.error('Error applying scheduled prices:', error);
        }
    }
};
