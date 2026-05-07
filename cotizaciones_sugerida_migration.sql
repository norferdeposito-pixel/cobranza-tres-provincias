-- Marca cotización como "Proveedor sugerido" (precarga del vendedor)
ALTER TABLE public.cotizaciones_items
  ADD COLUMN IF NOT EXISTS sugerida boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_cotizaciones_items_sugerida
  ON public.cotizaciones_items (item_id) WHERE sugerida = true;
