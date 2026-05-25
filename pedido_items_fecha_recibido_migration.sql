ALTER TABLE public.pedido_items
ADD COLUMN IF NOT EXISTS fecha_recibido date;
