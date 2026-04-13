-- Add 'code' and 'unit_value' columns to procurement_inventory table
ALTER TABLE public.procurement_inventory 
ADD COLUMN IF NOT EXISTS code TEXT,
ADD COLUMN IF NOT EXISTS unit_value NUMERIC DEFAULT 0;

-- Optionally, we can create an index on 'code' for faster searching during Excel upload
CREATE INDEX IF NOT EXISTS idx_procurement_inventory_code ON public.procurement_inventory(code);
