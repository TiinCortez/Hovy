-- =============================================================================
-- 015_drop_constraint_pagos_comprobante_uidx.sql
-- Fecha de creación: 2026-11-03
--
-- Reglas de idempotencia (Expand/Contract):
--   - Usá CREATE TABLE IF NOT EXISTS ...
--   - Usá ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...
--   - Usá CREATE INDEX IF NOT EXISTS ...
-- =============================================================================

-- Eliminar el índice/constraint único pagos_comprobante_uidx sobre (medio_pago, referencia_comprobante).
-- Justificación:
--   1. Los pagos manuales (Efectivo y Transferencia) permiten notas libres u opcionales
--      y pagos en cuotas/parciales de un mismo turno.
--   2. Cuando un turno se paga en dos partes en efectivo (ej. 50% y 50%) sin nota manual,
--      ambos registros toman por defecto 'Efectivo - turno X', provocando violación de
--      unicidad (error 23505) e impidiendo saldar la deuda restante.
--   3. Para Mercado Pago sí se garantiza la unicidad del ID de pago externo (mp_payment_id),
--      evitando que un mismo pago de Mercado Pago se acredite dos veces.

ALTER TABLE public.pagos
  DROP CONSTRAINT IF EXISTS pagos_comprobante_uidx;

DROP INDEX IF EXISTS public.pagos_comprobante_uidx;

-- Unicidad estricta para Mercado Pago (mp_payment_id no nulo):
CREATE UNIQUE INDEX IF NOT EXISTS pagos_mercadopago_comprobante_uidx
  ON public.pagos (referencia_comprobante)
  WHERE medio_pago IN ('MercadoPago', 'MercadoPago_QR') AND referencia_comprobante IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS cobros_mercadopago_payment_id_uidx
  ON public.cobros_mercadopago (mp_payment_id)
  WHERE mp_payment_id IS NOT NULL;
