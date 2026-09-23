import { supabase } from './supabaseClient';
import { Vehicle, VehicleDocument, VehicleSchedule } from '../types';
import { 
    FleetMaintenance, 
    FleetPart, 
    FleetPurchase, 
    FleetStockMovement, 
    FleetSupplier, 
    FleetHistoryEvent, 
    FleetSettings, 
    VehicleHealthInfo,
    HealthStatus,
    MaintenanceType,
    FleetMaintenanceType
} from '../types/fleetTypes';
import { AbastecimentoRecord } from './abastecimentoService';

const DEFAULT_SETTINGS: FleetSettings = {
    oilAlertThresholdKm: 500,
    timingBeltAlertThresholdKm: 2000,
    maintenanceAlertThresholdDays: 15,
    defaultOilKm: 5000,
    defaultTimingBeltKm: 50000
};

// Local cache storage keys for seamless offline/initial fallback
const STORAGE_KEYS = {
    SUPPLIERS: 'fleet_local_suppliers',
    PARTS: 'fleet_local_parts',
    MOVEMENTS: 'fleet_local_movements',
    PURCHASES: 'fleet_local_purchases',
    MAINTENANCES: 'fleet_local_maintenances',
    HISTORY: 'fleet_local_history',
    SETTINGS: 'fleet_local_settings'
};

const getLocal = <T>(key: string, fallback: T): T => {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : fallback;
    } catch {
        return fallback;
    }
};

const setLocal = <T>(key: string, value: T): void => {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch {}
};

export const fleetManagementService = {
    // =========================================================================
    // 1. CONFIGURAÇÕES DA FROTA
    // =========================================================================
    async getSettings(): Promise<FleetSettings> {
        try {
            const { data, error } = await supabase
                .from('fleet_settings')
                .select('value')
                .eq('key', 'general')
                .single();

            if (!error && data?.value) {
                const settings = { ...DEFAULT_SETTINGS, ...data.value };
                setLocal(STORAGE_KEYS.SETTINGS, settings);
                return settings;
            }
        } catch {}
        return getLocal(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
    },

    async saveSettings(settings: FleetSettings): Promise<FleetSettings> {
        setLocal(STORAGE_KEYS.SETTINGS, settings);
        try {
            await supabase
                .from('fleet_settings')
                .upsert({
                    key: 'general',
                    value: settings,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'key' });
        } catch (err) {
            console.warn('Erro ao persistir configurações no Supabase:', err);
        }
        return settings;
    },

    // =========================================================================
    // 2. FORNECEDORES / OFICINAS / AUTOPEÇAS
    // =========================================================================
    async getSuppliers(): Promise<FleetSupplier[]> {
        try {
            const { data, error } = await supabase
                .from('fleet_suppliers')
                .select('*')
                .order('name', { ascending: true });

            if (!error && data) {
                setLocal(STORAGE_KEYS.SUPPLIERS, data);
                return data;
            }
        } catch {}
        return getLocal(STORAGE_KEYS.SUPPLIERS, []);
    },

    async createSupplier(supplier: Omit<FleetSupplier, 'id' | 'created_at' | 'updated_at'>): Promise<FleetSupplier> {
        const newSupplier: FleetSupplier = {
            id: crypto.randomUUID(),
            ...supplier,
            active: supplier.active ?? true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        try {
            const { data, error } = await supabase
                .from('fleet_suppliers')
                .insert([newSupplier])
                .select()
                .single();

            if (!error && data) {
                const list = await this.getSuppliers();
                setLocal(STORAGE_KEYS.SUPPLIERS, [...list.filter(s => s.id !== data.id), data]);
                await this.logHistory({
                    event_type: 'alteracao_cadastral',
                    title: `Fornecedor cadastrado: ${data.name}`,
                    description: `Tipo: ${data.type} | Cidade: ${data.city || 'N/A'}`
                });
                return data;
            }
        } catch {}

        const list = getLocal<FleetSupplier[]>(STORAGE_KEYS.SUPPLIERS, []);
        const updated = [...list, newSupplier];
        setLocal(STORAGE_KEYS.SUPPLIERS, updated);
        return newSupplier;
    },

    async updateSupplier(id: string, updates: Partial<FleetSupplier>): Promise<FleetSupplier | null> {
        try {
            const { data, error } = await supabase
                .from('fleet_suppliers')
                .update({ ...updates, updated_at: new Date().toISOString() })
                .eq('id', id)
                .select()
                .single();

            if (!error && data) {
                const list = await this.getSuppliers();
                setLocal(STORAGE_KEYS.SUPPLIERS, list.map(s => s.id === id ? data : s));
                return data;
            }
        } catch {}

        const list = getLocal<FleetSupplier[]>(STORAGE_KEYS.SUPPLIERS, []);
        const updated = list.map(s => s.id === id ? { ...s, ...updates, updated_at: new Date().toISOString() } : s);
        setLocal(STORAGE_KEYS.SUPPLIERS, updated);
        return updated.find(s => s.id === id) || null;
    },

    async deleteSupplier(id: string): Promise<boolean> {
        try {
            const { error } = await supabase.from('fleet_suppliers').delete().eq('id', id);
            if (!error) {
                const list = await this.getSuppliers();
                setLocal(STORAGE_KEYS.SUPPLIERS, list.filter(s => s.id !== id));
                return true;
            }
        } catch {}

        const list = getLocal<FleetSupplier[]>(STORAGE_KEYS.SUPPLIERS, []);
        setLocal(STORAGE_KEYS.SUPPLIERS, list.filter(s => s.id !== id));
        return true;
    },

    // =========================================================================
    // 3. CATÁLOGO DE PEÇAS & COMPATIBILIDADE
    // =========================================================================
    async getParts(): Promise<FleetPart[]> {
        try {
            const { data, error } = await supabase
                .from('fleet_parts')
                .select('*, preferred_supplier:fleet_suppliers(*)')
                .order('name', { ascending: true });

            if (!error && data) {
                setLocal(STORAGE_KEYS.PARTS, data);
                return data;
            }
        } catch {}
        return getLocal(STORAGE_KEYS.PARTS, []);
    },

    async createPart(part: Omit<FleetPart, 'id' | 'created_at' | 'updated_at'>): Promise<FleetPart> {
        const newPart: FleetPart = {
            id: crypto.randomUUID(),
            ...part,
            active: part.active ?? true,
            current_stock: Number(part.current_stock) || 0,
            min_stock: Number(part.min_stock) || 0,
            last_purchase_price: Number(part.last_purchase_price) || 0,
            average_cost: Number(part.average_cost) || Number(part.last_purchase_price) || 0,
            compatible_vehicles: part.compatible_vehicles || [],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        try {
            const { data, error } = await supabase
                .from('fleet_parts')
                .insert([{
                    id: newPart.id,
                    name: newPart.name,
                    code: newPart.code,
                    reference: newPart.reference,
                    category: newPart.category,
                    brand: newPart.brand,
                    manufacturer: newPart.manufacturer,
                    unit: newPart.unit,
                    compatible_vehicles: newPart.compatible_vehicles,
                    current_stock: newPart.current_stock,
                    min_stock: newPart.min_stock,
                    location: newPart.location,
                    last_purchase_price: newPart.last_purchase_price,
                    average_cost: newPart.average_cost,
                    preferred_supplier_id: newPart.preferred_supplier_id,
                    notes: newPart.notes,
                    active: newPart.active
                }])
                .select('*, preferred_supplier:fleet_suppliers(*)')
                .single();

            if (!error && data) {
                const list = await this.getParts();
                setLocal(STORAGE_KEYS.PARTS, [...list.filter(p => p.id !== data.id), data]);

                // Se houver estoque inicial maior que zero, registrar movimentação inicial
                if (newPart.current_stock > 0) {
                    await this.createStockMovement({
                        part_id: data.id,
                        type: 'ajuste',
                        quantity: newPart.current_stock,
                        unit_cost: newPart.average_cost,
                        previous_stock: 0,
                        new_stock: newPart.current_stock,
                        reason: 'Saldo inicial de implantação de cadastro'
                    });
                }

                await this.logHistory({
                    event_type: 'peca_instalada',
                    title: `Peça cadastrada no catálogo: ${data.name}`,
                    description: `Código: ${data.code || 'N/A'} | Categoria: ${data.category} | Estoque Inicial: ${data.current_stock} ${data.unit}`
                });

                return data;
            }
        } catch {}

        const list = getLocal<FleetPart[]>(STORAGE_KEYS.PARTS, []);
        const updated = [...list, newPart];
        setLocal(STORAGE_KEYS.PARTS, updated);
        return newPart;
    },

    async updatePart(id: string, updates: Partial<FleetPart>): Promise<FleetPart | null> {
        try {
            const { data, error } = await supabase
                .from('fleet_parts')
                .update({ ...updates, updated_at: new Date().toISOString() })
                .eq('id', id)
                .select('*, preferred_supplier:fleet_suppliers(*)')
                .single();

            if (!error && data) {
                const list = await this.getParts();
                setLocal(STORAGE_KEYS.PARTS, list.map(p => p.id === id ? data : p));
                return data;
            }
        } catch {}

        const list = getLocal<FleetPart[]>(STORAGE_KEYS.PARTS, []);
        const updated = list.map(p => p.id === id ? { ...p, ...updates, updated_at: new Date().toISOString() } : p);
        setLocal(STORAGE_KEYS.PARTS, updated);
        return updated.find(p => p.id === id) || null;
    },

    async deletePart(id: string): Promise<boolean> {
        try {
            const { error } = await supabase.from('fleet_parts').delete().eq('id', id);
            if (!error) {
                const list = await this.getParts();
                setLocal(STORAGE_KEYS.PARTS, list.filter(p => p.id !== id));
                return true;
            }
        } catch {}

        const list = getLocal<FleetPart[]>(STORAGE_KEYS.PARTS, []);
        setLocal(STORAGE_KEYS.PARTS, list.filter(p => p.id !== id));
        return true;
    },

    // =========================================================================
    // 4. ESTOQUE & MOVIMENTAÇÕES
    // =========================================================================
    async getStockMovements(partId?: string): Promise<FleetStockMovement[]> {
        try {
            let query = supabase
                .from('fleet_stock_movements')
                .select('*, part:fleet_parts(*), vehicle:vehicles(*)')
                .order('created_at', { ascending: false });

            if (partId) {
                query = query.eq('part_id', partId);
            }

            const { data, error } = await query;
            if (!error && data) {
                setLocal(STORAGE_KEYS.MOVEMENTS, data);
                return data;
            }
        } catch {}

        const local = getLocal<FleetStockMovement[]>(STORAGE_KEYS.MOVEMENTS, []);
        return partId ? local.filter(m => m.part_id === partId) : local;
    },

    async createStockMovement(movement: {
        part_id: string;
        type: 'entrada' | 'saida' | 'ajuste';
        quantity: number;
        unit_cost?: number;
        previous_stock?: number;
        new_stock?: number;
        reason: string;
        maintenance_id?: string;
        purchase_id?: string;
        vehicle_id?: string;
        user_id?: string;
        user_name?: string;
    }): Promise<FleetStockMovement> {
        // Obter peça atual para calcular novo saldo
        const parts = await this.getParts();
        const part = parts.find(p => p.id === movement.part_id);
        const prevStock = Number(movement.previous_stock ?? part?.current_stock ?? 0);
        let calcNewStock = prevStock;

        if (movement.type === 'entrada') {
            calcNewStock = prevStock + Number(movement.quantity);
        } else if (movement.type === 'saida') {
            calcNewStock = Math.max(0, prevStock - Number(movement.quantity));
        } else if (movement.type === 'ajuste') {
            calcNewStock = Number(movement.quantity);
        }

        const unitCost = Number(movement.unit_cost ?? part?.average_cost ?? part?.last_purchase_price ?? 0);
        const totalCost = unitCost * Number(movement.quantity);

        const newMovement: FleetStockMovement = {
            id: crypto.randomUUID(),
            part_id: movement.part_id,
            part,
            type: movement.type,
            quantity: Number(movement.quantity),
            unit_cost: unitCost,
            total_cost: totalCost,
            previous_stock: prevStock,
            new_stock: calcNewStock,
            reason: movement.reason,
            maintenance_id: movement.maintenance_id,
            purchase_id: movement.purchase_id,
            vehicle_id: movement.vehicle_id,
            user_id: movement.user_id,
            user_name: movement.user_name,
            created_at: new Date().toISOString()
        };

        // 1. Atualizar saldo da peça
        await this.updatePart(movement.part_id, {
            current_stock: calcNewStock,
            last_purchase_price: movement.type === 'entrada' && unitCost > 0 ? unitCost : part?.last_purchase_price,
            average_cost: movement.type === 'entrada' && unitCost > 0
                ? ((prevStock * (part?.average_cost || unitCost)) + (Number(movement.quantity) * unitCost)) / (calcNewStock || 1)
                : part?.average_cost
        });

        // 2. Salvar movimentação no Supabase
        try {
            const { data, error } = await supabase
                .from('fleet_stock_movements')
                .insert([{
                    id: newMovement.id,
                    part_id: newMovement.part_id,
                    type: newMovement.type,
                    quantity: newMovement.quantity,
                    unit_cost: newMovement.unit_cost,
                    total_cost: newMovement.total_cost,
                    previous_stock: newMovement.previous_stock,
                    new_stock: newMovement.new_stock,
                    reason: newMovement.reason,
                    maintenance_id: newMovement.maintenance_id,
                    purchase_id: newMovement.purchase_id,
                    vehicle_id: newMovement.vehicle_id,
                    user_id: newMovement.user_id,
                    user_name: newMovement.user_name
                }])
                .select('*, part:fleet_parts(*), vehicle:vehicles(*)')
                .single();

            if (!error && data) {
                const list = getLocal<FleetStockMovement[]>(STORAGE_KEYS.MOVEMENTS, []);
                setLocal(STORAGE_KEYS.MOVEMENTS, [data, ...list.filter(m => m.id !== data.id)]);
                return data;
            }
        } catch {}

        const list = getLocal<FleetStockMovement[]>(STORAGE_KEYS.MOVEMENTS, []);
        setLocal(STORAGE_KEYS.MOVEMENTS, [newMovement, ...list]);
        return newMovement;
    },

    // =========================================================================
    // 5. COMPRAS DE PEÇAS & ENTRADA AUTOMÁTICA
    // =========================================================================
    async getPurchases(): Promise<FleetPurchase[]> {
        try {
            const { data, error } = await supabase
                .from('fleet_purchases')
                .select('*, supplier:fleet_suppliers(*), items:fleet_purchase_items(*, part:fleet_parts(*))')
                .order('purchase_date', { ascending: false });

            if (!error && data) {
                setLocal(STORAGE_KEYS.PURCHASES, data);
                return data;
            }
        } catch {}
        return getLocal(STORAGE_KEYS.PURCHASES, []);
    },

    async createPurchase(purchase: {
        supplier_id?: string;
        purchase_date: string;
        invoice_number?: string;
        status?: 'Pendente' | 'Pedido' | 'Recebido' | 'Cancelado';
        document_url?: string;
        notes?: string;
        items: Array<{
            part_id: string;
            quantity: number;
            unit_price: number;
        }>;
        user_id?: string;
        user_name?: string;
    }): Promise<FleetPurchase> {
        const totalAmount = purchase.items.reduce((acc, it) => acc + (Number(it.quantity) * Number(it.unit_price)), 0);
        const purchaseId = crypto.randomUUID();
        const status = purchase.status || 'Pendente';

        const newPurchase: FleetPurchase = {
            id: purchaseId,
            supplier_id: purchase.supplier_id,
            purchase_date: purchase.purchase_date,
            invoice_number: purchase.invoice_number,
            status,
            total_amount: totalAmount,
            document_url: purchase.document_url,
            notes: purchase.notes,
            user_id: purchase.user_id,
            user_name: purchase.user_name,
            received_at: status === 'Recebido' ? new Date().toISOString() : undefined,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        try {
            // Inserir compra
            await supabase.from('fleet_purchases').insert([newPurchase]);

            // Inserir itens
            const itemsToInsert = purchase.items.map(it => ({
                id: crypto.randomUUID(),
                purchase_id: purchaseId,
                part_id: it.part_id,
                quantity: Number(it.quantity),
                unit_price: Number(it.unit_price),
                total_price: Number(it.quantity) * Number(it.unit_price)
            }));

            if (itemsToInsert.length > 0) {
                await supabase.from('fleet_purchase_items').insert(itemsToInsert);
            }

            // Se já foi criada como 'Recebido', dar entrada imediata no estoque
            if (status === 'Recebido') {
                for (const item of purchase.items) {
                    await this.createStockMovement({
                        part_id: item.part_id,
                        type: 'entrada',
                        quantity: item.quantity,
                        unit_cost: item.unit_price,
                        reason: `Entrada via Compra NF ${purchase.invoice_number || purchaseId.substring(0, 8)}`,
                        purchase_id: purchaseId,
                        user_id: purchase.user_id,
                        user_name: purchase.user_name
                    });
                }
            }

            await this.logHistory({
                event_type: 'compra',
                title: `Ordem de Compra ${purchase.invoice_number ? `NF ${purchase.invoice_number}` : 'registrada'}`,
                description: `Valor Total: R$ ${totalAmount.toFixed(2)} | Status: ${status} | ${purchase.items.length} itens`
            });

            const fresh = await this.getPurchases();
            return fresh.find(p => p.id === purchaseId) || newPurchase;
        } catch (err) {
            console.warn('Fallback local ao criar compra:', err);
        }

        const list = getLocal<FleetPurchase[]>(STORAGE_KEYS.PURCHASES, []);
        setLocal(STORAGE_KEYS.PURCHASES, [newPurchase, ...list]);
        return newPurchase;
    },

    async updatePurchaseStatus(purchaseId: string, status: 'Pendente' | 'Pedido' | 'Recebido' | 'Cancelado', user?: { id?: string; name?: string }): Promise<void> {
        const purchases = await this.getPurchases();
        const purchase = purchases.find(p => p.id === purchaseId);
        if (!purchase) return;

        const previousStatus = purchase.status;

        try {
            await supabase
                .from('fleet_purchases')
                .update({ 
                    status, 
                    received_at: status === 'Recebido' ? new Date().toISOString() : null,
                    updated_at: new Date().toISOString() 
                })
                .eq('id', purchaseId);
        } catch {}

        // Se transitou para 'Recebido', dar entrada automática no estoque
        if (status === 'Recebido' && previousStatus !== 'Recebido') {
            const items = purchase.items || [];
            for (const item of items) {
                await this.createStockMovement({
                    part_id: item.part_id,
                    type: 'entrada',
                    quantity: item.quantity,
                    unit_cost: item.unit_price,
                    reason: `Recebimento de Compra NF ${purchase.invoice_number || purchaseId.substring(0, 8)}`,
                    purchase_id: purchaseId,
                    user_id: user?.id,
                    user_name: user?.name
                });
            }

            await this.logHistory({
                event_type: 'compra',
                title: `Compra Recebida: NF ${purchase.invoice_number || purchaseId.substring(0, 8)}`,
                description: `Itens integrados ao estoque automaticamente. Total: R$ ${purchase.total_amount.toFixed(2)}`
            });
        }
    },

    // =========================================================================
    // 6. MANUTENÇÕES & BAIXA DE PEÇAS
    // =========================================================================
    async getMaintenances(vehicleId?: string): Promise<FleetMaintenance[]> {
        try {
            let query = supabase
                .from('fleet_maintenances')
                .select('*, vehicle:vehicles(*), supplier:fleet_suppliers(*), parts_used:fleet_maintenance_parts(*, part:fleet_parts(*))')
                .order('maintenance_date', { ascending: false });

            if (vehicleId) {
                query = query.eq('vehicle_id', vehicleId);
            }

            const { data, error } = await query;
            if (!error && data) {
                setLocal(STORAGE_KEYS.MAINTENANCES, data);
                return data;
            }
        } catch {}

        const local = getLocal<FleetMaintenance[]>(STORAGE_KEYS.MAINTENANCES, []);
        return vehicleId ? local.filter(m => m.vehicle_id === vehicleId) : local;
    },

    async createMaintenance(maintenance: {
        vehicle_id: string;
        type: FleetMaintenanceType;
        maintenance_date: string;
        current_km: number;
        description: string;
        supplier_id?: string;
        supplier_name?: string;
        workshop_name?: string;
        responsible_name?: string;
        labor_cost?: number;
        control_type?: 'km' | 'data' | 'km_data';
        periodicity_km?: number;
        periodicity_days?: number;
        notes?: string;
        document_url?: string;
        parts_used?: Array<{
            part_id?: string;
            part_name: string;
            quantity: number;
            unit_price: number;
            origin: 'Estoque' | 'Compra específica';
            notes?: string;
        }>;
        created_by?: string;
        created_by_name?: string;
    }): Promise<FleetMaintenance> {
        const maintenanceId = crypto.randomUUID();
        const safeKm = Math.round(Number(maintenance.current_km) || 0);
        const laborCost = Number(maintenance.labor_cost) || 0;
        const partsUsed = maintenance.parts_used || [];
        const partsCost = partsUsed.reduce((acc, p) => acc + (Number(p.quantity) * Number(p.unit_price)), 0);
        const totalCost = laborCost + partsCost;

        // Calcular próximas previsões
        let nextDueKm: number | undefined;
        let nextDueDate: string | undefined;

        if (maintenance.periodicity_km && maintenance.periodicity_km > 0) {
            nextDueKm = safeKm + Number(maintenance.periodicity_km);
        }

        if (maintenance.periodicity_days && maintenance.periodicity_days > 0) {
            const dt = new Date(maintenance.maintenance_date + 'T12:00:00');
            dt.setDate(dt.getDate() + Number(maintenance.periodicity_days));
            nextDueDate = dt.toISOString().split('T')[0];
        }

        const newMaintenance: FleetMaintenance = {
            id: maintenanceId,
            vehicle_id: maintenance.vehicle_id,
            type: maintenance.type,
            maintenance_date: maintenance.maintenance_date,
            current_km: safeKm,
            description: maintenance.description,
            supplier_id: maintenance.supplier_id,
            supplier_name: maintenance.supplier_name,
            workshop_name: maintenance.workshop_name,
            responsible_name: maintenance.responsible_name,
            labor_cost: laborCost,
            parts_cost: partsCost,
            total_cost: totalCost,
            control_type: maintenance.control_type || 'km',
            periodicity_km: maintenance.periodicity_km,
            periodicity_days: maintenance.periodicity_days,
            next_due_km: nextDueKm,
            next_due_date: nextDueDate,
            notes: maintenance.notes,
            document_url: maintenance.document_url,
            status: 'Concluída',
            created_by: maintenance.created_by,
            created_by_name: maintenance.created_by_name,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        try {
            // 1. Inserir Manutenção
            await supabase.from('fleet_maintenances').insert([newMaintenance]);

            // 2. Processar Peças Utilizadas e Baixa no Estoque
            for (const item of partsUsed) {
                let stockMovementId: string | undefined;

                // Se a peça veio do estoque e tem ID cadastrado, realizar baixa atômica
                if (item.origin === 'Estoque' && item.part_id) {
                    const movement = await this.createStockMovement({
                        part_id: item.part_id,
                        type: 'saida',
                        quantity: item.quantity,
                        unit_cost: item.unit_price,
                        reason: `Aplicação em Manutenção (${maintenance.type}) - Veículo ${maintenance.vehicle_id}`,
                        maintenance_id: maintenanceId,
                        vehicle_id: maintenance.vehicle_id,
                        user_id: maintenance.created_by,
                        user_name: maintenance.created_by_name
                    });
                    stockMovementId = movement.id;
                }

                // Inserir registro de peça vinculada
                await supabase.from('fleet_maintenance_parts').insert([{
                    id: crypto.randomUUID(),
                    maintenance_id: maintenanceId,
                    part_id: item.part_id,
                    part_name: item.part_name,
                    quantity: Number(item.quantity),
                    unit_price: Number(item.unit_price),
                    total_price: Number(item.quantity) * Number(item.unit_price),
                    origin: item.origin,
                    stock_movement_id: stockMovementId,
                    notes: item.notes
                }]);
            }

            // 3. Atualizar Odômetro e Troca de Óleo / Correia no Veículo se for o caso
            const { data: vData } = await supabase.from('vehicles').select('*').eq('id', maintenance.vehicle_id).single();
            if (vData) {
                const vehicleUpdates: Record<string, any> = {};

                // Se o KM da manutenção for maior que o KM atual do veículo
                if (safeKm > (vData.current_km || 0)) {
                    vehicleUpdates.current_km = safeKm;
                }

                // Se for manutenção de Óleo
                if (maintenance.type === 'Óleo') {
                    const base = vData.oil_calculation_base || 5000;
                    vehicleUpdates.oil_last_change = safeKm;
                    vehicleUpdates.oil_next_change = safeKm + base;

                    // Também inserir na tabela legada vehicle_oil_changes para retrocompatibilidade
                    try {
                        await supabase.from('vehicle_oil_changes').insert([{
                            vehicle_id: maintenance.vehicle_id,
                            current_km: safeKm,
                            service_date: maintenance.maintenance_date
                        }]);
                    } catch {}
                }

                // Se for manutenção de Correia dentada
                if (maintenance.type === 'Correia dentada') {
                    const base = vData.timing_belt_calculation_base || 50000;
                    vehicleUpdates.timing_belt_last_change = safeKm;
                    vehicleUpdates.timing_belt_next_change = safeKm + base;

                    try {
                        await supabase.from('vehicle_timing_belt_changes').insert([{
                            vehicle_id: maintenance.vehicle_id,
                            current_km: safeKm,
                            service_date: maintenance.maintenance_date
                        }]);
                    } catch {}
                }

                if (Object.keys(vehicleUpdates).length > 0) {
                    await supabase.from('vehicles').update(vehicleUpdates).eq('id', maintenance.vehicle_id);
                }
            }

            // 4. Registrar no histórico geral
            await this.logHistory({
                vehicle_id: maintenance.vehicle_id,
                event_type: 'manutencao',
                title: `Manutenção realizada: ${maintenance.type}`,
                description: `${maintenance.description} | KM: ${safeKm.toLocaleString('pt-BR')} | Valor: R$ ${totalCost.toFixed(2)} | Oficina: ${maintenance.workshop_name || maintenance.supplier_name || 'Interna'}`
            });

            const fresh = await this.getMaintenances(maintenance.vehicle_id);
            return fresh.find(m => m.id === maintenanceId) || newMaintenance;
        } catch (err) {
            console.warn('Fallback local ao criar manutenção:', err);
        }

        const list = getLocal<FleetMaintenance[]>(STORAGE_KEYS.MAINTENANCES, []);
        setLocal(STORAGE_KEYS.MAINTENANCES, [newMaintenance, ...list]);
        return newMaintenance;
    },

    // =========================================================================
    // 7. HISTÓRICO GERAL & AUDITORIA
    // =========================================================================
    async getHistory(filters?: { vehicleId?: string; eventType?: string; startDate?: string; endDate?: string }): Promise<FleetHistoryEvent[]> {
        try {
            let query = supabase
                .from('fleet_history')
                .select('*, vehicle:vehicles(*)')
                .order('created_at', { ascending: false });

            if (filters?.vehicleId) query = query.eq('vehicle_id', filters.vehicleId);
            if (filters?.eventType) query = query.eq('event_type', filters.eventType);
            if (filters?.startDate) query = query.gte('created_at', filters.startDate);
            if (filters?.endDate) query = query.lte('created_at', filters.endDate);

            const { data, error } = await query;
            if (!error && data) {
                setLocal(STORAGE_KEYS.HISTORY, data);
                return data;
            }
        } catch {}

        let local = getLocal<FleetHistoryEvent[]>(STORAGE_KEYS.HISTORY, []);
        if (filters?.vehicleId) local = local.filter(h => h.vehicle_id === filters.vehicleId);
        if (filters?.eventType) local = local.filter(h => h.event_type === filters.eventType);
        return local;
    },

    async logHistory(event: {
        vehicle_id?: string;
        event_type: FleetHistoryEvent['event_type'];
        title: string;
        description?: string;
        metadata?: Record<string, any>;
        user_id?: string;
        user_name?: string;
    }): Promise<void> {
        const newEvent: FleetHistoryEvent = {
            id: crypto.randomUUID(),
            vehicle_id: event.vehicle_id,
            event_type: event.event_type,
            title: event.title,
            description: event.description,
            metadata: event.metadata,
            user_id: event.user_id,
            user_name: event.user_name,
            created_at: new Date().toISOString()
        };

        try {
            await supabase.from('fleet_history').insert([newEvent]);
        } catch {}

        const list = getLocal<FleetHistoryEvent[]>(STORAGE_KEYS.HISTORY, []);
        setLocal(STORAGE_KEYS.HISTORY, [newEvent, ...list.slice(0, 200)]);
    },

    // =========================================================================
    // 8. CÁLCULO DE SAÚDE DO VEÍCULO & SAÚDE DA FROTA
    // =========================================================================
    calculateVehicleHealth(
        vehicle: Vehicle, 
        maintenances: FleetMaintenance[] = [], 
        settings: FleetSettings = DEFAULT_SETTINGS
    ): VehicleHealthInfo {
        const currentKm = Number(vehicle.currentKm) || 0;

        // 1. Troca de Óleo
        const oilBase = vehicle.oilCalculationBase || settings.defaultOilKm || 5000;
        const oilLast = Number(vehicle.oilLastChange) || 0;
        const oilNext = Number(vehicle.oilNextChange) || (oilLast > 0 ? oilLast + oilBase : 0);
        const oilKmRemaining = oilNext > 0 ? oilNext - currentKm : undefined;

        let oilStatus: HealthStatus = 'em_dia';
        if (oilNext > 0) {
            if (currentKm >= oilNext) {
                oilStatus = 'vencido';
            } else if (oilKmRemaining !== undefined && oilKmRemaining <= settings.oilAlertThresholdKm) {
                oilStatus = 'proximo';
            }
        }

        // 2. Correia Dentada
        const beltBase = vehicle.timingBeltCalculationBase || settings.defaultTimingBeltKm || 50000;
        const beltLast = Number(vehicle.timingBeltLastChange) || 0;
        const beltNext = Number(vehicle.timingBeltNextChange) || (beltLast > 0 ? beltLast + beltBase : 0);
        const beltKmRemaining = beltNext > 0 ? beltNext - currentKm : undefined;

        let timingBeltStatus: HealthStatus = 'em_dia';
        if (beltNext > 0) {
            if (currentKm >= beltNext) {
                timingBeltStatus = 'vencido';
            } else if (beltKmRemaining !== undefined && beltKmRemaining <= settings.timingBeltAlertThresholdKm) {
                timingBeltStatus = 'proximo';
            }
        }

        // 3. Avaliar Manutenções Cadastradas do Veículo
        const vMaintenances = maintenances.filter(m => m.vehicle_id === vehicle.id);
        const today = new Date().toISOString().split('T')[0];

        const overdueList: FleetMaintenance[] = [];
        const upcomingList: FleetMaintenance[] = [];

        // Check specific types status
        let tiresStatus: HealthStatus = 'em_dia';
        let brakesStatus: HealthStatus = 'em_dia';
        let filtersStatus: HealthStatus = 'em_dia';
        let suspensionStatus: HealthStatus = 'em_dia';
        let batteryStatus: HealthStatus = 'em_dia';
        let reviewStatus: HealthStatus = 'em_dia';

        for (const m of vMaintenances) {
            let isOverdue = false;
            let isUpcoming = false;

            if (m.next_due_km && m.next_due_km > 0) {
                const diffKm = m.next_due_km - currentKm;
                if (currentKm >= m.next_due_km) isOverdue = true;
                else if (diffKm <= settings.oilAlertThresholdKm) isUpcoming = true;
            }

            if (m.next_due_date) {
                const diffDays = Math.ceil((new Date(m.next_due_date + 'T12:00:00').getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                if (today >= m.next_due_date) isOverdue = true;
                else if (diffDays <= settings.maintenanceAlertThresholdDays) isUpcoming = true;
            }

            if (isOverdue) overdueList.push(m);
            else if (isUpcoming) upcomingList.push(m);

            const typeStatus: HealthStatus = isOverdue ? 'vencido' : isUpcoming ? 'proximo' : 'em_dia';
            if (m.type === 'Pneus' && (typeStatus === 'vencido' || (typeStatus === 'proximo' && tiresStatus !== 'vencido'))) tiresStatus = typeStatus;
            if (m.type === 'Freios' && (typeStatus === 'vencido' || (typeStatus === 'proximo' && brakesStatus !== 'vencido'))) brakesStatus = typeStatus;
            if (m.type === 'Filtros' && (typeStatus === 'vencido' || (typeStatus === 'proximo' && filtersStatus !== 'vencido'))) filtersStatus = typeStatus;
            if (m.type === 'Suspensão' && (typeStatus === 'vencido' || (typeStatus === 'proximo' && suspensionStatus !== 'vencido'))) suspensionStatus = typeStatus;
            if (m.type === 'Bateria' && (typeStatus === 'vencido' || (typeStatus === 'proximo' && batteryStatus !== 'vencido'))) batteryStatus = typeStatus;
            if (m.type === 'Revisão' && (typeStatus === 'vencido' || (typeStatus === 'proximo' && reviewStatus !== 'vencido'))) reviewStatus = typeStatus;
        }

        // 4. Status Geral da Saúde do Veículo:
        // 🔴 Vencido: se Óleo, Correia ou qualquer manutenção estiver vencida
        // 🟡 Próximo: se não houver vencido, mas pelo menos uma estiver próxima
        // 🟢 Em dia: se tudo estiver 100% em dia
        let generalStatus: HealthStatus = 'em_dia';
        if (oilStatus === 'vencido' || timingBeltStatus === 'vencido' || overdueList.length > 0) {
            generalStatus = 'vencido';
        } else if (oilStatus === 'proximo' || timingBeltStatus === 'proximo' || upcomingList.length > 0) {
            generalStatus = 'proximo';
        }

        return {
            vehicleId: vehicle.id,
            generalStatus,
            oilStatus,
            oilKmRemaining,
            oilKmNext: oilNext > 0 ? oilNext : undefined,
            timingBeltStatus,
            timingBeltKmRemaining: beltKmRemaining,
            timingBeltKmNext: beltNext > 0 ? beltNext : undefined,
            tiresStatus,
            brakesStatus,
            filtersStatus,
            suspensionStatus,
            batteryStatus,
            reviewStatus,
            overdueMaintenancesCount: overdueList.length + (oilStatus === 'vencido' ? 1 : 0) + (timingBeltStatus === 'vencido' ? 1 : 0),
            upcomingMaintenancesCount: upcomingList.length + (oilStatus === 'proximo' ? 1 : 0) + (timingBeltStatus === 'proximo' ? 1 : 0),
            overdueList,
            upcomingList,
            lastOilChangeKm: oilLast > 0 ? oilLast : undefined,
            lastTimingBeltChangeKm: beltLast > 0 ? beltLast : undefined
        };
    },

    // =========================================================================
    // 9. PRONTUÁRIO COMPLETO DO VEÍCULO (/Frota/Veiculos/:id)
    // =========================================================================
    async getVehicleProntuario(vehicleId: string): Promise<{
        vehicle: Vehicle | null;
        health: VehicleHealthInfo | null;
        maintenances: FleetMaintenance[];
        abastecimentos: AbastecimentoRecord[];
        schedules: VehicleSchedule[];
        documents: VehicleDocument[];
        partsInstalled: Array<{
            id: string;
            part_name: string;
            quantity: number;
            unit_price: number;
            total_price: number;
            maintenance_date: string;
            maintenance_km: number;
            maintenance_type: string;
            workshop_name?: string;
        }>;
        costsSummary: {
            totalFuelCost: number;
            totalMaintenanceCost: number;
            totalPartsCost: number;
            totalCost: number;
            avgConsumptionKml: number;
            totalLiters: number;
            abastecimentosCount: number;
        };
        oilHistory: Array<{
            id: string;
            current_km: number;
            service_date: string;
        }>;
        timingBeltHistory: Array<{
            id: string;
            current_km: number;
            service_date: string;
        }>;
    }> {
        // 1. Obter Veículo
        const { data: vData } = await supabase.from('vehicles').select('*').eq('id', vehicleId).single();
        const vehicle: Vehicle | null = vData ? {
            id: vData.id,
            type: vData.type,
            model: vData.model,
            plate: vData.plate,
            brand: vData.brand,
            year: vData.year,
            color: vData.color,
            renavam: vData.renavam,
            chassis: vData.chassis,
            sectorId: vData.sector_id,
            responsiblePersonId: vData.responsible_person_id,
            documentUrl: vData.document_url,
            documentName: vData.document_name,
            vehicleImageUrl: vData.vehicle_image_url,
            status: vData.status,
            maintenanceStatus: vData.maintenance_status,
            vehicleCategory: vData.vehicle_category,
            availableForScheduling: vData.available_for_scheduling,
            fuelTypes: vData.fuel_types,
            requestManagerIds: vData.request_manager_ids,
            maxKml: vData.max_kml,
            minKml: vData.min_kml,
            currentKm: vData.current_km,
            oilLastChange: vData.oil_last_change,
            oilNextChange: vData.oil_next_change,
            oilCalculationBase: vData.oil_calculation_base,
            timingBeltLastChange: vData.timing_belt_last_change,
            timingBeltNextChange: vData.timing_belt_next_change,
            timingBeltCalculationBase: vData.timing_belt_calculation_base,
            passengerCapacity: vData.passenger_capacity
        } : null;

        if (!vehicle) {
            return {
                vehicle: null,
                health: null,
                maintenances: [],
                abastecimentos: [],
                schedules: [],
                documents: [],
                partsInstalled: [],
                costsSummary: { totalFuelCost: 0, totalMaintenanceCost: 0, totalPartsCost: 0, totalCost: 0, avgConsumptionKml: 0, totalLiters: 0, abastecimentosCount: 0 },
                oilHistory: [],
                timingBeltHistory: []
            };
        }

        // 2. Obter Abastecimentos do Veículo (busca por placa ou modelo)
        let vehicleAbast: AbastecimentoRecord[] = [];
        try {
            const { data: aData } = await supabase
                .from('abastecimentos')
                .select('*')
                .or(`vehicle.ilike.%${vehicle.plate}%,vehicle.ilike.%${vehicle.model}%`)
                .order('date', { ascending: false });

            if (aData) {
                vehicleAbast = aData.map((r: any) => ({
                    id: r.id,
                    protocol: r.protocol,
                    fiscal: r.fiscal,
                    date: r.date,
                    vehicle: r.vehicle,
                    driver: r.driver,
                    fuelType: r.fuel_type,
                    liters: Number(r.liters) || 0,
                    odometer: Number(r.odometer) || 0,
                    cost: Number(r.cost) || 0,
                    station: r.station,
                    invoiceNumber: r.invoice_number,
                    created_at: r.created_at
                }));
            }
        } catch {}

        // Sincronização do Odômetro: O maior odômetro registrado nos abastecimentos atualiza automaticamente o KM Atual
        if (vehicleAbast.length > 0) {
            const maxOdometrer = Math.max(...vehicleAbast.map(a => a.odometer || 0));
            if (maxOdometrer > (vehicle.currentKm || 0)) {
                vehicle.currentKm = maxOdometrer;
                try {
                    await supabase.from('vehicles').update({ current_km: maxOdometrer }).eq('id', vehicle.id);
                } catch {}
            }
        }

        // 3. Obter Manutenções
        const maintenances = await this.getMaintenances(vehicleId);

        // 4. Obter Histórico de Óleo e Correia
        let oilHistory: any[] = [];
        try {
            const { data: oData } = await supabase
                .from('vehicle_oil_changes')
                .select('id, current_km, service_date')
                .eq('vehicle_id', vehicleId)
                .order('service_date', { ascending: false });
            oilHistory = oData || [];
        } catch {}

        let timingBeltHistory: any[] = [];
        try {
            const { data: tData } = await supabase
                .from('vehicle_timing_belt_changes')
                .select('id, current_km, service_date')
                .eq('vehicle_id', vehicleId)
                .order('service_date', { ascending: false });
            timingBeltHistory = tData || [];
        } catch {}

        // 5. Obter Agendamentos do Veículo
        let schedules: VehicleSchedule[] = [];
        try {
            const { data: sData } = await supabase
                .from('vehicle_schedules')
                .select('*')
                .eq('vehicle_id', vehicleId)
                .order('departure_date_time', { ascending: false });
            if (sData) {
                schedules = sData.map((s: any) => ({
                    id: s.id,
                    protocol: s.protocol,
                    vehicleId: s.vehicle_id,
                    driverId: s.driver_id,
                    serviceSectorId: s.service_sector_id,
                    requesterPersonId: s.requester_person_id,
                    departureDateTime: s.departure_date_time,
                    returnDateTime: s.return_date_time,
                    destination: s.destination,
                    purpose: s.purpose,
                    status: s.status,
                    requesterId: s.requester_id,
                    createdAt: s.created_at,
                    vehicleLocation: s.vehicle_location,
                    authorizedByName: s.authorized_by_name,
                    passengers: s.passengers,
                    patientCount: s.patient_count,
                    companionCount: s.companion_count
                }));
            }
        } catch {}

        // 6. Obter Documentos
        let documents: VehicleDocument[] = [];
        try {
            const { data: dData } = await supabase
                .from('vehicle_documents')
                .select('*')
                .eq('vehicle_id', vehicleId)
                .order('created_at', { ascending: false });
            documents = dData || [];
        } catch {}

        // 7. Peças Instaladas (agregadas das manutenções)
        const partsInstalled: any[] = [];
        let totalPartsCost = 0;
        let totalMaintenanceCost = 0;

        for (const m of maintenances) {
            totalMaintenanceCost += m.total_cost || 0;
            if (m.parts_used && m.parts_used.length > 0) {
                for (const pu of m.parts_used) {
                    totalPartsCost += pu.total_price || 0;
                    partsInstalled.push({
                        id: pu.id,
                        part_name: pu.part_name,
                        quantity: pu.quantity,
                        unit_price: pu.unit_price,
                        total_price: pu.total_price,
                        maintenance_date: m.maintenance_date,
                        maintenance_km: m.current_km,
                        maintenance_type: m.type,
                        workshop_name: m.workshop_name || m.supplier_name
                    });
                }
            }
        }

        // 8. Resumo de Custos
        const totalFuelCost = vehicleAbast.reduce((acc, a) => acc + (a.cost || 0), 0);
        const totalLiters = vehicleAbast.reduce((acc, a) => acc + (a.liters || 0), 0);
        const totalCost = totalFuelCost + totalMaintenanceCost;

        // Cálculo de consumo médio (km rodados / litros)
        let avgConsumptionKml = 0;
        if (vehicleAbast.length >= 2 && totalLiters > 0) {
            const sortedOdo = [...vehicleAbast].sort((a, b) => (a.odometer || 0) - (b.odometer || 0));
            const kmMin = sortedOdo[0].odometer || 0;
            const kmMax = sortedOdo[sortedOdo.length - 1].odometer || 0;
            const deltaKm = kmMax - kmMin;
            if (deltaKm > 0 && totalLiters > 0) {
                avgConsumptionKml = Number((deltaKm / totalLiters).toFixed(2));
            }
        }

        // 9. Cálculo de Saúde do Veículo
        const settings = await this.getSettings();
        const health = this.calculateVehicleHealth(vehicle, maintenances, settings);

        return {
            vehicle,
            health,
            maintenances,
            abastecimentos: vehicleAbast,
            schedules,
            documents,
            partsInstalled,
            costsSummary: {
                totalFuelCost,
                totalMaintenanceCost,
                totalPartsCost,
                totalCost,
                avgConsumptionKml,
                totalLiters,
                abastecimentosCount: vehicleAbast.length
            },
            oilHistory,
            timingBeltHistory
        };
    }
};
