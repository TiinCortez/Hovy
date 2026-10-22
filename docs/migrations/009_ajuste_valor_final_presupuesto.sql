-- =============================================================================
-- 009_ajuste_valor_final_presupuesto.sql
-- Migración de paridad para edición del valor final de presupuestos (VAL-168)
-- y limpieza de columnas huérfanas (presupuestos.documento_pdf_url y turnos.cobrado).
-- =============================================================================

ALTER TABLE public.presupuestos
  ADD COLUMN IF NOT EXISTS diferencia_ajuste NUMERIC(12, 2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS motivo_ajuste TEXT;

ALTER TABLE public.presupuestos
  DROP COLUMN IF EXISTS documento_pdf_url;

ALTER TABLE public.turnos
  DROP COLUMN IF EXISTS cobrado;
