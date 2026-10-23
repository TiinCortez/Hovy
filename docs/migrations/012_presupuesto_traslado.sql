-- =============================================================================
-- 012_presupuesto_traslado.sql
-- Fecha de creación: 2026-10-23
--
-- Reglas de idempotencia (Expand/Contract):
--   - Usá CREATE TABLE IF NOT EXISTS ...
--   - Usá ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...
--   - Usá CREATE INDEX IF NOT EXISTS ...
-- =============================================================================

-- Escribí tus sentencias SQL idempotentes acá abajo:

-- Costo de traslado del presupuesto (combustible del vehículo hasta el inmueble).
-- Se guarda una foto de los datos usados para que el monto no cambie si después
-- sube la nafta o el jefe cambia su vehículo. Todo es NULLable: un presupuesto sin
-- traslado (usuario sin configurar, inmueble sin ubicación) queda como siempre.
ALTER TABLE public.presupuestos
  ADD COLUMN IF NOT EXISTS monto_traslado         NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS traslado_km            NUMERIC(8, 2),
  ADD COLUMN IF NOT EXISTS traslado_consumo_100km NUMERIC(6, 2),
  ADD COLUMN IF NOT EXISTS traslado_precio_unidad NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS traslado_unidad        TEXT,
  ADD COLUMN IF NOT EXISTS traslado_combustible   TEXT,
  -- TRUE cuando los km son una estimación (línea recta x factor de rodeo) y no
  -- una ruta real de OpenRouteService.
  ADD COLUMN IF NOT EXISTS traslado_aproximado     BOOLEAN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'presupuestos_traslado_unidad_check'
  ) THEN
    ALTER TABLE public.presupuestos
      ADD CONSTRAINT presupuestos_traslado_unidad_check
      CHECK (traslado_unidad IS NULL OR traslado_unidad IN ('l', 'm3'));
  END IF;
END $$;
