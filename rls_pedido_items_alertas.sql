-- RLS for easy-po-dash (Supabase Auth + anon/publishable client in src/lib/supabase.ts).
--
-- Context: the app loads order detail with nested selects on pedido_items, alertas,
-- pedidos, and proveedores. PostgREST evaluates RLS on each table in the join chain.
--
-- Policies:
--   easy_po_dash_pedido_items_authenticated_all — authenticated users may read/write
--     all rows (incl. fecha_recibido); matches internal OC dashboard usage.
--   easy_po_dash_alertas_authenticated_select — authenticated read-only; the SPA only
--     selects alertas (writes may be done by service role or DB jobs).
--   easy_po_dash_pedidos_authenticated_all — read for joins + insert/update from Index.
--   easy_po_dash_proveedores_authenticated_all — read for nested pedidos(proveedores)
--     plus proveedor CRUD from the dashboard.
--
-- Run this in the Supabase SQL editor or via psql after reviewing for your environment.

-- ---------------------------------------------------------------------------
-- pedido_items
-- ---------------------------------------------------------------------------
ALTER TABLE public.pedido_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS easy_po_dash_pedido_items_authenticated_all ON public.pedido_items;

CREATE POLICY easy_po_dash_pedido_items_authenticated_all
  ON public.pedido_items
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- alertas
-- ---------------------------------------------------------------------------
ALTER TABLE public.alertas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS easy_po_dash_alertas_authenticated_select ON public.alertas;

CREATE POLICY easy_po_dash_alertas_authenticated_select
  ON public.alertas
  FOR SELECT
  TO authenticated
  USING (true);

-- ---------------------------------------------------------------------------
-- pedidos (required for pedido_items / alertas nested selects)
-- ---------------------------------------------------------------------------
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS easy_po_dash_pedidos_authenticated_all ON public.pedidos;

CREATE POLICY easy_po_dash_pedidos_authenticated_all
  ON public.pedidos
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- proveedores (required for pedidos(proveedores(...)) in the same queries)
-- ---------------------------------------------------------------------------
ALTER TABLE public.proveedores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS easy_po_dash_proveedores_authenticated_all ON public.proveedores;

CREATE POLICY easy_po_dash_proveedores_authenticated_all
  ON public.proveedores
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
