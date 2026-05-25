-- Backfill histórico: pedido_items.fecha_recibido para pedidos terminado / recibido_total.
-- Requisito: columna pedido_items.fecha_recibido (ver pedido_items_fecha_recibido_migration.sql).
--
-- Reglas:
--   - Solo ítems con fecha_recibido IS NULL.
--   - Solo pedidos con estado terminado o recibido_total (case-insensitive).
--   - Valor asignado: COALESCE(pedidos.fecha_recibido, fecha desde updated_at, fecha_estimada_entrega).
--   - Si public.pedidos no tiene columna fecha_recibido, se omite en el COALESCE (detectado en runtime).
--
-- Ejecutar en Supabase SQL Editor (o psql) una vez por entorno.

DO $$
DECLARE
  has_pedidos_fecha_recibido boolean;
  has_pedidos_updated_at boolean;
  sql text;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'pedidos'
      AND c.column_name = 'fecha_recibido'
  )
  INTO has_pedidos_fecha_recibido;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'pedidos'
      AND c.column_name = 'updated_at'
  )
  INTO has_pedidos_updated_at;

  IF has_pedidos_fecha_recibido AND has_pedidos_updated_at THEN
    sql := $q$
      UPDATE public.pedido_items pi
      SET fecha_recibido = sub.d::date
      FROM (
        SELECT
          p.id AS pedido_id,
          COALESCE(
            p.fecha_recibido::date,
            (p.updated_at AT TIME ZONE 'UTC')::date,
            p.fecha_estimada_entrega::date
          ) AS d
        FROM public.pedidos p
        WHERE lower(coalesce(p.estado, '')) IN ('terminado', 'recibido_total')
      ) sub
      WHERE pi.pedido_id = sub.pedido_id
        AND pi.fecha_recibido IS NULL
        AND sub.d IS NOT NULL
    $q$;
  ELSIF has_pedidos_fecha_recibido THEN
    sql := $q$
      UPDATE public.pedido_items pi
      SET fecha_recibido = sub.d::date
      FROM (
        SELECT
          p.id AS pedido_id,
          COALESCE(
            p.fecha_recibido::date,
            p.fecha_estimada_entrega::date
          ) AS d
        FROM public.pedidos p
        WHERE lower(coalesce(p.estado, '')) IN ('terminado', 'recibido_total')
      ) sub
      WHERE pi.pedido_id = sub.pedido_id
        AND pi.fecha_recibido IS NULL
        AND sub.d IS NOT NULL
    $q$;
  ELSIF has_pedidos_updated_at THEN
    sql := $q$
      UPDATE public.pedido_items pi
      SET fecha_recibido = sub.d::date
      FROM (
        SELECT
          p.id AS pedido_id,
          COALESCE(
            (p.updated_at AT TIME ZONE 'UTC')::date,
            p.fecha_estimada_entrega::date
          ) AS d
        FROM public.pedidos p
        WHERE lower(coalesce(p.estado, '')) IN ('terminado', 'recibido_total')
      ) sub
      WHERE pi.pedido_id = sub.pedido_id
        AND pi.fecha_recibido IS NULL
        AND sub.d IS NOT NULL
    $q$;
  ELSE
    sql := $q$
      UPDATE public.pedido_items pi
      SET fecha_recibido = sub.d::date
      FROM (
        SELECT
          p.id AS pedido_id,
          p.fecha_estimada_entrega::date AS d
        FROM public.pedidos p
        WHERE lower(coalesce(p.estado, '')) IN ('terminado', 'recibido_total')
          AND p.fecha_estimada_entrega IS NOT NULL
      ) sub
      WHERE pi.pedido_id = sub.pedido_id
        AND pi.fecha_recibido IS NULL
    $q$;
  END IF;

  EXECUTE sql;
END $$;
