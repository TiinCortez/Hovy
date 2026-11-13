-- =============================================================================
-- 018_solicitud_cliente_existente.sql
-- Fecha de creación: 2026-11-12
--
-- Reglas de idempotencia (Expand/Contract):
--   - Usá CREATE TABLE IF NOT EXISTS ...
--   - Usá ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...
--   - Usá CREATE INDEX IF NOT EXISTS ...
-- =============================================================================

-- Pedidos de turno de clientes existentes desde el bot de WhatsApp.
--
-- Un cliente que ya tiene sus inmuebles cargados elige inmueble, servicio y
-- fecha, y su pedido llega a "Solicitudes -> Clientes" listo para presupuesto:
-- se crea directamente en estado Confirmada con id_cliente e id_inmueble, que
-- es lo único que exige la cadena presupuesto -> turno existente.
--
-- 1. tipo_solicitud distingue el contacto nuevo ('nuevo', el flujo de siempre)
--    del pedido de un cliente existente ('cliente'). Las filas existentes vienen
--    todas del flujo de contacto nuevo, así que el DEFAULT 'nuevo' las describe bien.
-- 2. La notificación "nueva_solicitud" también se dispara para un pedido de
--    cliente que espera presupuesto (antes solo para Pendiente). Se resuelve
--    sola cuando se le carga el presupuesto (id_presupuesto deja de ser NULL).

-- 1. Columna tipo_solicitud --------------------------------------------------------
ALTER TABLE public.solicitudes_visita
  ADD COLUMN IF NOT EXISTS tipo_solicitud TEXT NOT NULL DEFAULT 'nuevo';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'solicitudes_visita_tipo_solicitud_check'
      AND conrelid = 'public.solicitudes_visita'::regclass
  ) THEN
    ALTER TABLE public.solicitudes_visita
      ADD CONSTRAINT solicitudes_visita_tipo_solicitud_check
      CHECK (tipo_solicitud IN ('nuevo', 'cliente'));
  END IF;
END $$;

-- Un solo pedido de cliente abierto (Confirmada sin turno) por inmueble: cierra
-- la carrera de dos reintentos simultáneos del bot. La API traduce el 23505 a
-- un 409. Las filas existentes son todas 'nuevo', así que no hay conflictos.
CREATE UNIQUE INDEX IF NOT EXISTS uq_solicitudes_visita_pedido_cliente_abierto
  ON public.solicitudes_visita (id_inmueble)
  WHERE tipo_solicitud = 'cliente' AND estado = 'Confirmada' AND id_turno IS NULL;

-- 2. Notificaciones: misma función que 017, con la rama nueva_solicitud ampliada ---
CREATE OR REPLACE FUNCTION public.fn_notificaciones_actuales()
RETURNS TABLE (
  tipo               TEXT,
  id_referencia      INTEGER,
  id_cliente         INTEGER,
  mensaje            TEXT,
  fecha_notificacion TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH hoy AS (
    SELECT (now() AT TIME ZONE 'America/Argentina/Cordoba')::date AS fecha
  ),
  -- Último turno Realizado por inmueble que incluya un servicio de corte o césped.
  ultimos_cortes AS (
    SELECT DISTINCT ON (t.id_inmueble)
      t.id_turno, t.id_inmueble, t.fecha_programada
    FROM turnos t
    WHERE t.estado = 'Realizado'
      AND EXISTS (
        SELECT 1
        FROM detalle_presupuesto dp
        JOIN servicios_catalogo sc ON sc.id_servicio = dp.id_servicio
        WHERE dp.id_presupuesto = t.id_presupuesto
          AND translate(lower(sc.nombre), 'é', 'e') LIKE ANY (ARRAY['%cesped%', '%corte%'])
      )
    ORDER BY t.id_inmueble, t.fecha_programada DESC, t.id_turno DESC
  )
  -- Ciclo de corte
  SELECT
    'ciclo_corte'::text,
    uc.id_turno::integer,
    i.id_cliente::integer,
    format(
      'Césped en %s excede los 15 días sin corte (último corte: %s).',
      coalesce(nullif(concat_ws(', ', i.direccion, i.barrio), ''), 'un inmueble sin dirección')
        || coalesce(' — ' || nullif(concat_ws(' ', cl.nombre, cl.apellido), ''), ''),
      to_char(uc.fecha_programada, 'DD/MM')
    ),
    ((uc.fecha_programada + 15)::timestamp AT TIME ZONE 'America/Argentina/Cordoba')
  FROM ultimos_cortes uc
  JOIN inmuebles i ON i.id_inmueble = uc.id_inmueble
  LEFT JOIN clientes cl ON cl.id_cliente = i.id_cliente
  CROSS JOIN hoy
  WHERE i.activo = TRUE
    AND uc.fecha_programada <= hoy.fecha - 15
    AND NOT EXISTS (
      SELECT 1
      FROM turnos f
      WHERE f.id_inmueble = uc.id_inmueble
        AND f.estado IN ('Coordinado', 'Confirmado', 'En ejecución')
        AND f.fecha_programada >= hoy.fecha
    )

  UNION ALL

  -- Nueva solicitud: contacto nuevo en Pendiente, o pedido de cliente existente
  -- que todavía espera presupuesto.
  SELECT
    'nueva_solicitud'::text,
    s.id_solicitud::integer,
    NULL::integer,          -- igual que 017: el destino es la solicitud, no el cliente
    CASE
      WHEN s.tipo_solicitud = 'cliente' THEN format(
        '%s pidió un turno%s%s. Falta asignarle el presupuesto.',
        coalesce(nullif(concat_ws(' ', s.nombre, s.apellido), ''), 'Un cliente'),
        coalesce(' para ' || nullif(trim(s.servicio), ''), ''),
        coalesce(' en ' || nullif(trim(s.direccion), ''), '')
      )
      ELSE format(
        '%s solicitó contacto%s.',
        coalesce(nullif(concat_ws(' ', s.nombre, s.apellido), ''), 'Un cliente'),
        coalesce(' para ' || nullif(trim(s.servicio), ''), '')
      )
    END,
    s.created_at
  FROM solicitudes_visita s
  WHERE s.estado = 'Pendiente'
     OR (s.tipo_solicitud = 'cliente' AND s.estado = 'Confirmada' AND s.id_presupuesto IS NULL)

  UNION ALL

  -- Turno sin confirmar (Coordinado)
  SELECT
    'turno_sin_confirmar'::text,
    t.id_turno::integer,
    i.id_cliente::integer,
    format(
      'El turno del %s en %s sigue sin confirmar.',
      to_char(t.fecha_programada, 'DD/MM'),
      coalesce(nullif(concat_ws(', ', i.direccion, i.barrio), ''), 'un inmueble sin dirección')
    ),
    now()   -- solo se usa la primera vez que se detecta (después no se pisa)
  FROM turnos t
  LEFT JOIN inmuebles i ON i.id_inmueble = t.id_inmueble
  WHERE t.estado = 'Coordinado';
$$;
