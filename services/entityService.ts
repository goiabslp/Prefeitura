import { supabase } from './supabaseClient';
import { Person, Sector, Job, Vehicle, VehicleBrand, Signature } from '../types';
import { birthdaySyncService } from './birthdaySyncService';

// Sectors
export const getSectors = async (): Promise<Sector[]> => {
    const { data, error } = await supabase.from('sectors').select('id, name').order('name');
    if (error) {
        console.error('Error fetching sectors:', error);
        return [];
    }
    return data || [];
};

export const createSector = async (sector: Sector): Promise<Sector | null> => {
    const { data, error } = await supabase
        .from('sectors')
        .insert([{ name: sector.name }])
        .select()
        .single();

    if (error) {
        console.error('Error creating sector:', error);
        return null;
    }
    return data;
};

export const updateSector = async (sector: Sector): Promise<Sector | null> => {
    const { data, error } = await supabase
        .from('sectors')
        .update({ name: sector.name })
        .eq('id', sector.id)
        .select()
        .single();

    if (error) {
        console.error('Error updating sector:', error);
        return null;
    }
    return data;
};

export const deleteSector = async (id: string): Promise<boolean> => {
    const { error } = await supabase.from('sectors').delete().eq('id', id);
    if (error) {
        console.error('Error deleting sector:', error);
        return false;
    }
    return true;
};

// Jobs
export const getJobs = async (): Promise<Job[]> => {
    const { data, error } = await supabase.from('jobs').select('id, name').order('name');
    if (error) {
        console.error('Error fetching jobs:', error);
        return [];
    }
    return data || [];
};

export const createJob = async (job: Job): Promise<Job | null> => {
    const { data, error } = await supabase
        .from('jobs')
        .insert([{ name: job.name }])
        .select()
        .single();

    if (error) {
        console.error('Error creating job:', error);
        return null;
    }
    return data;
};

export const updateJob = async (job: Job): Promise<Job | null> => {
    const { data, error } = await supabase
        .from('jobs')
        .update({ name: job.name })
        .eq('id', job.id)
        .select()
        .single();

    if (error) {
        console.error('Error updating job:', error);
        return null;
    }
    return data;
};

export const deleteJob = async (id: string): Promise<boolean> => {
    const { error } = await supabase.from('jobs').delete().eq('id', id);
    if (error) {
        console.error('Error deleting job:', error);
        return false;
    }
    return true;
};

// Persons
export const getPersons = async (): Promise<Person[]> => {
    const { data, error } = await supabase
        .from('persons')
        .select('id, name, sector_id, job_id, birth_date, driver_code')
        .order('name');
    if (error) {
        console.error('Error fetching persons:', error);
        return [];
    }
    return data?.map(p => ({
        id: p.id,
        name: p.name,
        sectorId: p.sector_id,
        jobId: p.job_id,
        birth_date: p.birth_date,
        driver_code: p.driver_code
    })) || [];
};

export const createPerson = async (person: Person): Promise<Person | null> => {
    const { data, error } = await supabase
        .from('persons')
        .insert([{
            name: person.name,
            sector_id: person.sectorId,
            job_id: person.jobId,
            birth_date: person.birth_date,
            driver_code: person.driver_code
        }])
        .select()
        .single();

    if (error) {
        console.error('Error creating person:', error);
        return null;
    }

    const createdPerson = {
        id: data.id,
        name: data.name,
        sectorId: data.sector_id,
        jobId: data.job_id,
        birth_date: data.birth_date,
        driver_code: data.driver_code
    };

    // 🔹 Sync with Calendar
    await birthdaySyncService.syncPersonBirthday(createdPerson);

    return createdPerson;
};

export const updatePerson = async (person: Person): Promise<Person | null> => {
    const { data, error } = await supabase
        .from('persons')
        .update({
            name: person.name,
            sector_id: person.sectorId,
            job_id: person.jobId,
            birth_date: person.birth_date,
            driver_code: person.driver_code
        })
        .eq('id', person.id)
        .select()
        .single();

    if (error) {
        console.error('Error updating person:', error);
        return null;
    }

    const updatedPerson = {
        id: data.id,
        name: data.name,
        sectorId: data.sector_id,
        jobId: data.job_id,
        birth_date: data.birth_date,
        driver_code: data.driver_code
    };

    // 🔹 Sync with Calendar
    await birthdaySyncService.syncPersonBirthday(updatedPerson);

    return updatedPerson;
};

export const deletePerson = async (id: string): Promise<boolean> => {
    // 🔹 Remove from Calendar first (or after, but first is safer while we have ID)
    await birthdaySyncService.deletePersonBirthday(id);

    const { error } = await supabase.from('persons').delete().eq('id', id);
    if (error) {
        console.error('Error deleting person:', error);
        return false;
    }
    return true;
};

// Vehicles
// Vehicles
export const getVehicles = async (): Promise<Vehicle[]> => {
    try {
        const CHUNK_SIZE = 50;
        let allVehicles: any[] = [];
        let from = 0;
        let to = CHUNK_SIZE - 1;
        let keepFetching = true;

        // Fetch in chunks to avoid single massive JSON response failure
        const vehicleColumns = 'id, type, model, plate, brand, year, color, renavam, chassis, sector_id, responsible_person_id, document_url, document_name, vehicle_image_url, status, maintenance_status, fuel_types, request_manager_ids, max_kml, min_kml, current_km, oil_last_change, oil_next_change, oil_calculation_base, timing_belt_last_change, timing_belt_next_change, timing_belt_calculation_base, passenger_capacity, vehicle_category, available_for_scheduling';
        while (keepFetching) {
            const { data, error } = await supabase
                .from('vehicles')
                .select(vehicleColumns)
                .range(from, to);

            if (error) {
                console.error(`Error fetching vehicles chunk ${from}-${to}:`, error.message);
                // Instead of failing entirely, we stop fetching but try to return what we have
                break;
            }

            if (data) {
                allVehicles = [...allVehicles, ...data];

                // If we got fewer items than requested, we've reached the end
                if (data.length < CHUNK_SIZE) {
                    keepFetching = false;
                } else {
                    from += CHUNK_SIZE;
                    to += CHUNK_SIZE;
                }
            } else {
                keepFetching = false;
            }

            // Safety break to prevent infinite loops in case of weird API behavior
            if (from > 5000) break;
        }

        return allVehicles.map(v => mapVehicleFromDB(v));
    } catch (err) {
        console.error('Critical error in getVehicles:', err);
        return [];
    }
};

export const mapVehicleFromDB = (data: any): Vehicle => {
    return {
        id: data.id,
        type: data.type,
        model: data.model,
        plate: data.plate,
        brand: data.brand,
        year: data.year,
        color: data.color,
        renavam: data.renavam,
        chassis: data.chassis,
        sectorId: data.sector_id,
        responsiblePersonId: data.responsible_person_id,
        documentUrl: data.document_url,
        documentName: data.document_name,
        vehicleImageUrl: data.vehicle_image_url,
        status: data.status,
        maintenanceStatus: data.maintenance_status,
        fuelTypes: data.fuel_types,
        requestManagerIds: data.request_manager_ids || [],
        maxKml: data.max_kml,
        minKml: data.min_kml,
        currentKm: data.current_km,
        oilLastChange: data.oil_last_change,
        oilNextChange: data.oil_next_change,
        oilCalculationBase: data.oil_calculation_base,
        timingBeltLastChange: data.timing_belt_last_change,
        timingBeltNextChange: data.timing_belt_next_change,
        timingBeltCalculationBase: data.timing_belt_calculation_base,
        passengerCapacity: data.passenger_capacity,
        vehicleCategory: data.vehicle_category,
        availableForScheduling: data.available_for_scheduling
    };
};

export const getVehicleById = async (id: string): Promise<Vehicle | null> => {
    const vehicleColumns = 'id, type, model, plate, brand, year, color, renavam, chassis, sector_id, responsible_person_id, document_url, document_name, vehicle_image_url, status, maintenance_status, fuel_types, request_manager_ids, max_kml, min_kml, current_km, oil_last_change, oil_next_change, oil_calculation_base, timing_belt_last_change, timing_belt_next_change, timing_belt_calculation_base, passenger_capacity, vehicle_category, available_for_scheduling';
    const { data, error } = await supabase
        .from('vehicles')
        .select(vehicleColumns)
        .eq('id', id)
        .single();

    if (error) {
        console.error('Error fetching vehicle details:', error);
        return null;
    }

    return mapVehicleFromDB(data);
};

export const createVehicle = async (vehicle: Vehicle): Promise<Vehicle | null> => {
    // Validação de unicidade da placa
    const cleanPlate = (vehicle.plate || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    if (cleanPlate) {
        const { data: existingVehicles, error: checkError } = await supabase
            .from('vehicles')
            .select('id, plate, model, brand');

        if (!checkError && existingVehicles && existingVehicles.length > 0) {
            const duplicate = existingVehicles.find(v => (v.plate || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase() === cleanPlate);
            if (duplicate) {
                throw new Error(`A placa "${vehicle.plate}" já está cadastrada no veículo "${duplicate.model}" (${duplicate.brand || 'Frota'}). Não é permitido cadastrar a mesma placa em mais de um veículo.`);
            }
        }
    }

    const dbVehicle = {
        type: vehicle.type,
        model: vehicle.model,
        plate: vehicle.plate,
        brand: vehicle.brand,
        year: vehicle.year,
        color: vehicle.color,
        renavam: vehicle.renavam,
        chassis: vehicle.chassis,
        sector_id: vehicle.sectorId || null,
        responsible_person_id: vehicle.responsiblePersonId || null,
        document_url: vehicle.documentUrl,
        document_name: vehicle.documentName,
        vehicle_image_url: vehicle.vehicleImageUrl,
        status: vehicle.status,
        maintenance_status: vehicle.maintenanceStatus,
        fuel_types: vehicle.fuelTypes,
        request_manager_ids: vehicle.requestManagerIds || [],
        max_kml: vehicle.maxKml,
        min_kml: vehicle.minKml,
        current_km: vehicle.currentKm ? Math.round(vehicle.currentKm) : 0,
        oil_last_change: vehicle.oilLastChange ? Math.round(vehicle.oilLastChange) : null,
        oil_next_change: vehicle.oilNextChange ? Math.round(vehicle.oilNextChange) : null,
        oil_calculation_base: vehicle.oilCalculationBase,
        timing_belt_last_change: vehicle.timingBeltLastChange ? Math.round(vehicle.timingBeltLastChange) : null,
        timing_belt_next_change: vehicle.timingBeltNextChange ? Math.round(vehicle.timingBeltNextChange) : null,
        timing_belt_calculation_base: vehicle.timingBeltCalculationBase,
        passenger_capacity: vehicle.passengerCapacity,
        vehicle_category: vehicle.vehicleCategory,
        available_for_scheduling: vehicle.availableForScheduling || 'Sim'
    };

    const { data, error } = await supabase
        .from('vehicles')
        .insert([dbVehicle])
        .select()
        .single();

    if (error) {
        console.error('Error creating vehicle:', error);
        return null;
    }

    return mapVehicleFromDB(data);
};

export const updateVehicle = async (vehicle: Vehicle): Promise<Vehicle | null> => {
    // Validação de unicidade da placa na atualização
    const cleanPlate = (vehicle.plate || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    if (cleanPlate && vehicle.id) {
        const { data: existingVehicles, error: checkError } = await supabase
            .from('vehicles')
            .select('id, plate, model, brand')
            .neq('id', vehicle.id);

        if (!checkError && existingVehicles && existingVehicles.length > 0) {
            const duplicate = existingVehicles.find(v => (v.plate || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase() === cleanPlate);
            if (duplicate) {
                throw new Error(`A placa "${vehicle.plate}" já está cadastrada no veículo "${duplicate.model}" (${duplicate.brand || 'Frota'}). Não é permitido duplicar placas.`);
            }
        }
    }

    const dbVehicle = {
        type: vehicle.type,
        model: vehicle.model,
        plate: vehicle.plate,
        brand: vehicle.brand,
        year: vehicle.year,
        color: vehicle.color,
        renavam: vehicle.renavam,
        chassis: vehicle.chassis,
        sector_id: vehicle.sectorId || null,
        responsible_person_id: vehicle.responsiblePersonId || null,
        document_url: vehicle.documentUrl,
        document_name: vehicle.documentName,
        vehicle_image_url: vehicle.vehicleImageUrl,
        status: vehicle.status,
        maintenance_status: vehicle.maintenanceStatus,
        fuel_types: vehicle.fuelTypes,
        request_manager_ids: vehicle.requestManagerIds || [],
        max_kml: vehicle.maxKml,
        min_kml: vehicle.minKml,
        current_km: vehicle.currentKm ? Math.round(vehicle.currentKm) : 0,
        oil_last_change: vehicle.oilLastChange ? Math.round(vehicle.oilLastChange) : null,
        oil_next_change: vehicle.oilNextChange ? Math.round(vehicle.oilNextChange) : null,
        oil_calculation_base: vehicle.oilCalculationBase,
        timing_belt_last_change: vehicle.timingBeltLastChange ? Math.round(vehicle.timingBeltLastChange) : null,
        timing_belt_next_change: vehicle.timingBeltNextChange ? Math.round(vehicle.timingBeltNextChange) : null,
        timing_belt_calculation_base: vehicle.timingBeltCalculationBase,
        passenger_capacity: vehicle.passengerCapacity,
        vehicle_category: vehicle.vehicleCategory,
        available_for_scheduling: vehicle.availableForScheduling
    };

    const { data, error } = await supabase
        .from('vehicles')
        .update(dbVehicle)
        .eq('id', vehicle.id)
        .select()
        .single();

    if (error) {
        console.error('Error updating vehicle:', error);
        return null;
    }

    return mapVehicleFromDB(data);
};

export const deleteVehicle = async (id: string): Promise<boolean> => {
    const { error } = await supabase.from('vehicles').delete().eq('id', id);
    if (error) {
        console.error('Error deleting vehicle:', error);
        return false;
    }
    return true;
};

// Brands
export const getBrands = async (): Promise<VehicleBrand[]> => {
    const { data, error } = await supabase.from('vehicle_brands').select('id, name, category').order('name');
    if (error) {
        console.error('Error fetching brands:', error);
        return [];
    }
    return data || [];
};

export const createBrand = async (brand: VehicleBrand): Promise<VehicleBrand | null> => {
    const { data, error } = await supabase
        .from('vehicle_brands')
        .insert([{ name: brand.name, category: brand.category }])
        .select()
        .single();

    if (error) {
        console.error('Error creating brand:', error);
        return null;
    }
    return data;
};

export const deleteBrand = async (id: string): Promise<boolean> => {
    const { error } = await supabase.from('vehicle_brands').delete().eq('id', id);
    if (error) {
        console.error('Error deleting brand:', error);
        return false;
    }
    return true;
};

// Signatures
export const getSignatures = async (): Promise<Signature[]> => {
    const { data, error } = await supabase.from('signatures').select('id, name, role, sector').order('name');
    if (error) {
        console.error('Error fetching signatures:', error);
        return [];
    }
    return data || [];
};

export const createSignature = async (signature: Signature): Promise<Signature | null> => {
    const { data, error } = await supabase
        .from('signatures')
        .insert([{
            name: signature.name,
            role: signature.role,
            sector: signature.sector
        }])
        .select()
        .single();

    if (error) {
        console.error('Error creating signature:', error);
        return null;
    }
    return data;
};

export const updateSignature = async (signature: Signature): Promise<Signature | null> => {
    const { data, error } = await supabase
        .from('signatures')
        .update({
            name: signature.name,
            role: signature.role,
            sector: signature.sector
        })
        .eq('id', signature.id)
        .select()
        .single();

    if (error) {
        console.error('Error updating signature:', error);
        return null;
    }
    return data;
};

export const deleteSignature = async (id: string): Promise<boolean> => {
    const { error } = await supabase.from('signatures').delete().eq('id', id);
    if (error) {
        console.error('Error deleting signature:', error);
        return false;
    }
    return true;
};

// Users
export const getUsers = async (): Promise<any[]> => {
    const profileColumns = 'id, name, username, email, role, sector, sector_id, job_title, job_id, status, permissions, allowed_signature_ids, two_factor_enabled, two_factor_enabled_2, must_change_password';
    const { data, error } = await supabase.from('profiles').select(profileColumns).order('name');
    if (error) {
        console.error('Error fetching users:', error);
        return [];
    }
    return data || [];
};

