import { Vehicle, VehicleDocument, VehicleSchedule } from '../types';

export type HealthStatus = 'em_dia' | 'proximo' | 'vencido';

export interface VehicleHealthInfo {
    vehicleId: string;
    generalStatus: HealthStatus;
    oilStatus: HealthStatus;
    oilKmRemaining?: number;
    oilKmNext?: number;
    timingBeltStatus: HealthStatus;
    timingBeltKmRemaining?: number;
    timingBeltKmNext?: number;
    tiresStatus: HealthStatus;
    brakesStatus: HealthStatus;
    filtersStatus: HealthStatus;
    suspensionStatus: HealthStatus;
    batteryStatus: HealthStatus;
    reviewStatus: HealthStatus;
    overdueMaintenancesCount: number;
    upcomingMaintenancesCount: number;
    overdueList: FleetMaintenance[];
    upcomingList: FleetMaintenance[];
    lastOilChangeKm?: number;
    lastOilChangeDate?: string;
    lastTimingBeltChangeKm?: number;
    lastTimingBeltChangeDate?: string;
}

export interface FleetSupplier {
    id: string;
    name: string;
    trade_name?: string;
    cnpj_cpf?: string;
    type: 'Oficina' | 'Autopeças' | 'Concessionária' | 'Prestador' | 'Outro';
    phone?: string;
    email?: string;
    address?: string;
    city?: string;
    contact_person?: string;
    notes?: string;
    active?: boolean;
    created_at?: string;
    updated_at?: string;
}

export interface FleetPart {
    id: string;
    name: string;
    code?: string;
    reference?: string;
    category: string;
    brand?: string;
    manufacturer?: string;
    unit: 'UN' | 'LT' | 'KG' | 'PAR' | 'JG' | 'KIT' | string;
    compatible_vehicles: string[]; // vehicle IDs or model strings
    current_stock: number;
    min_stock: number;
    location?: string;
    last_purchase_price: number;
    average_cost: number;
    preferred_supplier_id?: string;
    preferred_supplier?: FleetSupplier;
    notes?: string;
    active?: boolean;
    created_at?: string;
    updated_at?: string;
}

export interface FleetStockMovement {
    id: string;
    part_id: string;
    part?: FleetPart;
    type: 'entrada' | 'saida' | 'ajuste';
    quantity: number;
    unit_cost: number;
    total_cost: number;
    previous_stock: number;
    new_stock: number;
    reason: string;
    maintenance_id?: string;
    purchase_id?: string;
    vehicle_id?: string;
    vehicle?: Vehicle;
    user_id?: string;
    user_name?: string;
    created_at: string;
}

export interface FleetPurchaseItem {
    id: string;
    purchase_id?: string;
    part_id: string;
    part?: FleetPart;
    part_name?: string;
    quantity: number;
    unit_price: number;
    total_price: number;
}

export interface FleetPurchase {
    id: string;
    supplier_id?: string;
    supplier?: FleetSupplier;
    purchase_date: string;
    invoice_number?: string;
    status: 'Pendente' | 'Pedido' | 'Recebido' | 'Cancelado';
    total_amount: number;
    document_url?: string;
    notes?: string;
    items?: FleetPurchaseItem[];
    user_id?: string;
    user_name?: string;
    received_at?: string;
    created_at?: string;
    updated_at?: string;
}

export interface FleetMaintenancePartUsed {
    id: string;
    maintenance_id?: string;
    part_id?: string;
    part?: FleetPart;
    part_name: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    origin: 'Estoque' | 'Compra específica';
    stock_movement_id?: string;
    notes?: string;
}

export type MaintenanceType = 
    | 'Preventiva' 
    | 'Corretiva' 
    | 'Óleo' 
    | 'Correia dentada' 
    | 'Pneus' 
    | 'Freios' 
    | 'Filtros' 
    | 'Suspensão' 
    | 'Revisão' 
    | 'Bateria' 
    | 'Outros';

export type FleetMaintenanceType = MaintenanceType;

export interface FleetMaintenance {
    id: string;
    vehicle_id: string;
    vehicle?: Vehicle;
    type: MaintenanceType;
    maintenance_date: string;
    current_km: number;
    description: string;
    supplier_id?: string;
    supplier?: FleetSupplier;
    supplier_name?: string;
    workshop_name?: string;
    responsible_name?: string;
    labor_cost: number;
    parts_cost: number;
    total_cost: number;
    control_type: 'km' | 'data' | 'km_data';
    periodicity_km?: number;
    periodicity_days?: number;
    next_due_km?: number;
    next_due_date?: string;
    notes?: string;
    document_url?: string;
    status: 'Agendada' | 'Em Execução' | 'Concluída' | 'Cancelada';
    parts_used?: FleetMaintenancePartUsed[];
    created_by?: string;
    created_by_name?: string;
    created_at?: string;
    updated_at?: string;
}

export interface FleetHistoryEvent {
    id: string;
    vehicle_id?: string;
    vehicle?: Vehicle;
    event_type: 
        | 'abastecimento' 
        | 'troca_oleo' 
        | 'troca_correia' 
        | 'manutencao' 
        | 'peca_instalada' 
        | 'compra' 
        | 'movimentacao_estoque' 
        | 'documento' 
        | 'agendamento' 
        | 'alteracao_cadastral' 
        | 'alteracao_disponibilidade';
    title: string;
    description?: string;
    metadata?: Record<string, any>;
    user_id?: string;
    user_name?: string;
    created_at: string;
}

export interface FleetSettings {
    oilAlertThresholdKm: number; // Ex: 500 km antes
    timingBeltAlertThresholdKm: number; // Ex: 2000 km antes
    maintenanceAlertThresholdDays: number; // Ex: 15 dias antes
    defaultOilKm: number; // Ex: 5000 / 10000
    defaultTimingBeltKm: number; // Ex: 50000
    fuelPriceEstimates?: Record<string, number>;
}
