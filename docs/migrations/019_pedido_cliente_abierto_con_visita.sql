-- 019: a client's request on a property nobody measured yet now starts
-- 'Pendiente' and goes through the visit (Pendiente -> Contactada -> Confirmada)
-- before the budget. The "one open client request per property" index from 018
-- only covered 'Confirmada', so two simultaneous bot retries could create two
-- 'Pendiente' rows. Widen it to every open state. The API already maps the
-- 23505 to a 409.
--
-- Before applying, check there are no duplicates (the CREATE fails otherwise):
--   SELECT id_inmueble, count(*)
--   FROM public.solicitudes_visita
--   WHERE tipo_solicitud = 'cliente'
--     AND estado IN ('Pendiente', 'Contactada', 'Confirmada')
--     AND id_turno IS NULL
--   GROUP BY id_inmueble
--   HAVING count(*) > 1;

BEGIN;

DROP INDEX IF EXISTS public.uq_solicitudes_visita_pedido_cliente_abierto;

CREATE UNIQUE INDEX uq_solicitudes_visita_pedido_cliente_abierto
  ON public.solicitudes_visita (id_inmueble)
  WHERE tipo_solicitud = 'cliente'
    AND estado IN ('Pendiente', 'Contactada', 'Confirmada')
    AND id_turno IS NULL;

COMMIT;
