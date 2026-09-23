-- ==============================================================================
-- MIGRAÇÃO: CENTRAL COMPLETA DE GESTÃO DA FROTA MUNICIPAL (/Frota)
-- ==============================================================================

-- 1. Tabela de Configurações da Frota
CREATE TABLE IF NOT EXISTS public.fleet_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    value JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabela de Fornecedores / Oficinas / Autopeças
CREATE TABLE IF NOT EXISTS public.fleet_suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    trade_name TEXT,
    cnpj_cpf TEXT,
    type TEXT NOT NULL DEFAULT 'Oficina', -- 'Oficina', 'Autopeças', 'Concessionária', 'Prestador', 'Outro'
    phone TEXT,
    email TEXT,
    address TEXT,
    city TEXT,
    contact_person TEXT,
    notes TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabela de Peças (Catálogo / Almoxarifado da Frota)
CREATE TABLE IF NOT EXISTS public.fleet_parts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    code TEXT,
    reference TEXT,
    category TEXT NOT NULL DEFAULT 'Geral', -- 'Motor', 'Freios', 'Suspensão', 'Filtros', 'Óleos/Fluidos', 'Elétrica', 'Pneus', 'Outros'
    brand TEXT,
    manufacturer TEXT,
    unit TEXT DEFAULT 'UN', -- 'UN', 'LT', 'KG', 'PAR', 'JG', 'KIT'
    compatible_vehicles JSONB DEFAULT '[]'::jsonb, -- Array de IDs de veículos ou modelos compatíveis
    current_stock NUMERIC NOT NULL DEFAULT 0,
    min_stock NUMERIC NOT NULL DEFAULT 0,
    location TEXT, -- Prateleira / Gaveta / Setor
    last_purchase_price NUMERIC DEFAULT 0,
    average_cost NUMERIC DEFAULT 0,
    preferred_supplier_id UUID REFERENCES public.fleet_suppliers(id) ON DELETE SET NULL,
    notes TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Tabela de Compras de Peças
CREATE TABLE IF NOT EXISTS public.fleet_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id UUID REFERENCES public.fleet_suppliers(id) ON DELETE SET NULL,
    purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
    invoice_number TEXT,
    status TEXT NOT NULL DEFAULT 'Pendente', -- 'Pendente', 'Pedido', 'Recebido', 'Cancelado'
    total_amount NUMERIC NOT NULL DEFAULT 0,
    document_url TEXT,
    notes TEXT,
    user_id UUID,
    user_name TEXT,
    received_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Itens da Compra de Peças
CREATE TABLE IF NOT EXISTS public.fleet_purchase_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_id UUID NOT NULL REFERENCES public.fleet_purchases(id) ON DELETE CASCADE,
    part_id UUID NOT NULL REFERENCES public.fleet_parts(id) ON DELETE RESTRICT,
    quantity NUMERIC NOT NULL DEFAULT 1,
    unit_price NUMERIC NOT NULL DEFAULT 0,
    total_price NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Tabela de Manutenções da Frota (Preventivas e Corretivas)
CREATE TABLE IF NOT EXISTS public.fleet_maintenances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- 'Preventiva', 'Corretiva', 'Óleo', 'Correia dentada', 'Pneus', 'Freios', 'Filtros', 'Suspensão', 'Revisão', 'Bateria', 'Outros'
    maintenance_date DATE NOT NULL DEFAULT CURRENT_DATE,
    current_km NUMERIC NOT NULL,
    description TEXT NOT NULL,
    supplier_id UUID REFERENCES public.fleet_suppliers(id) ON DELETE SET NULL,
    supplier_name TEXT,
    workshop_name TEXT,
    responsible_name TEXT,
    labor_cost NUMERIC DEFAULT 0,
    parts_cost NUMERIC DEFAULT 0,
    total_cost NUMERIC NOT NULL DEFAULT 0,
    control_type TEXT DEFAULT 'km', -- 'km', 'data', 'km_data'
    periodicity_km NUMERIC,
    periodicity_days NUMERIC,
    next_due_km NUMERIC,
    next_due_date DATE,
    notes TEXT,
    document_url TEXT,
    status TEXT DEFAULT 'Concluída', -- 'Agendada', 'Em Execução', 'Concluída', 'Cancelada'
    created_by UUID,
    created_by_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Tabela de Movimentações de Estoque
CREATE TABLE IF NOT EXISTS public.fleet_stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    part_id UUID NOT NULL REFERENCES public.fleet_parts(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- 'entrada', 'saida', 'ajuste'
    quantity NUMERIC NOT NULL,
    unit_cost NUMERIC DEFAULT 0,
    total_cost NUMERIC DEFAULT 0,
    previous_stock NUMERIC NOT NULL DEFAULT 0,
    new_stock NUMERIC NOT NULL DEFAULT 0,
    reason TEXT NOT NULL,
    maintenance_id UUID REFERENCES public.fleet_maintenances(id) ON DELETE SET NULL,
    purchase_id UUID REFERENCES public.fleet_purchases(id) ON DELETE SET NULL,
    vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
    user_id UUID,
    user_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Tabela de Peças Utilizadas em Manutenções
CREATE TABLE IF NOT EXISTS public.fleet_maintenance_parts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    maintenance_id UUID NOT NULL REFERENCES public.fleet_maintenances(id) ON DELETE CASCADE,
    part_id UUID REFERENCES public.fleet_parts(id) ON DELETE SET NULL,
    part_name TEXT NOT NULL,
    quantity NUMERIC NOT NULL DEFAULT 1,
    unit_price NUMERIC NOT NULL DEFAULT 0,
    total_price NUMERIC NOT NULL DEFAULT 0,
    origin TEXT NOT NULL DEFAULT 'Estoque', -- 'Estoque', 'Compra específica'
    stock_movement_id UUID REFERENCES public.fleet_stock_movements(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Tabela de Histórico e Auditoria Geral da Frota
CREATE TABLE IF NOT EXISTS public.fleet_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL, -- 'abastecimento', 'troca_oleo', 'troca_correia', 'manutencao', 'peca_instalada', 'compra', 'movimentacao_estoque', 'documento', 'agendamento', 'alteracao_cadastral', 'alteracao_disponibilidade'
    title TEXT NOT NULL,
    description TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    user_id UUID,
    user_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS e criar políticas públicas
ALTER TABLE public.fleet_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for fleet_settings" ON public.fleet_settings FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.fleet_suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for fleet_suppliers" ON public.fleet_suppliers FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.fleet_parts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for fleet_parts" ON public.fleet_parts FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.fleet_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for fleet_purchases" ON public.fleet_purchases FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.fleet_purchase_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for fleet_purchase_items" ON public.fleet_purchase_items FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.fleet_maintenances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for fleet_maintenances" ON public.fleet_maintenances FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.fleet_stock_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for fleet_stock_movements" ON public.fleet_stock_movements FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.fleet_maintenance_parts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for fleet_maintenance_parts" ON public.fleet_maintenance_parts FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.fleet_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for fleet_history" ON public.fleet_history FOR ALL USING (true) WITH CHECK (true);

-- Índices para Performance Máxima
CREATE INDEX IF NOT EXISTS idx_fleet_maintenances_vehicle_id ON public.fleet_maintenances(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_fleet_maintenances_date ON public.fleet_maintenances(maintenance_date DESC);
CREATE INDEX IF NOT EXISTS idx_fleet_stock_movements_part_id ON public.fleet_stock_movements(part_id);
CREATE INDEX IF NOT EXISTS idx_fleet_stock_movements_created_at ON public.fleet_stock_movements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fleet_history_vehicle_id ON public.fleet_history(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_fleet_history_created_at ON public.fleet_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fleet_purchases_supplier_id ON public.fleet_purchases(supplier_id);
