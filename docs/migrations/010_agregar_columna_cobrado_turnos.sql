-- =============================================================================
-- 010_agregar_columna_cobrado_turnos.sql
-- Fecha de creación: 2026-10-22
--
-- Propósito:
--   Agregar de forma idempotente y estandarizada la columna booleana `cobrado`
--   en la tabla `public.turnos` tanto en Staging como en Producción.
-- =============================================================================

ALTER TABLE public.turnos
  ADD COLUMN IF NOT EXISTS cobrado BOOLEAN DEFAULT FALSE;
