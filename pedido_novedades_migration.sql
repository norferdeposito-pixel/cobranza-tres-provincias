-- Historial de novedades por pedido para comunicación Compras/Vendedor.
-- Ejecutar en Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.pedido_novedades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  tipo text NOT NULL DEFAULT 'general',
  mensaje text NOT NULL,
  visible_vendedor boolean NOT NULL DEFAULT true,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pedido_novedades_pedido_id_created_at_idx
  ON public.pedido_novedades (pedido_id, created_at DESC);

ALTER TABLE public.pedido_novedades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS easy_po_dash_pedido_novedades_authenticated_all ON public.pedido_novedades;

CREATE POLICY easy_po_dash_pedido_novedades_authenticated_all
  ON public.pedido_novedades
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
