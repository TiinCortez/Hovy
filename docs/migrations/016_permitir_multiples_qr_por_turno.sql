-- =============================================================================
-- 016_permitir_multiples_qr_por_turno.sql
-- Fecha de creación: 2026-11-03
--
-- Reglas de idempotencia (Expand/Contract):
--   - Usá CREATE TABLE IF NOT EXISTS ...
--   - Usá ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...
--   - Usá CREATE INDEX IF NOT EXISTS ...
-- =============================================================================

-- Permitir múltiples cobros con QR de Mercado Pago sobre un mismo turno cuando
-- el turno se abona en pagos parciales.
--
-- El índice anterior bloqueaba cualquier nuevo QR si ya existía un cobro en
-- estado 'Aprobado' para ese id_turno, incluso después de que el pago parcial
-- hubiera impactado en la cuenta corriente (id_pago IS NOT NULL) y quedara
-- saldo pendiente.
--
-- Con este ajuste:
--   - Solo puede haber un cobro en curso por turno a la vez: 'Pendiente', o
--     'Aprobado' pendiente de impactar en el libro (id_pago IS NULL).
--   - Una vez que un cobro 'Aprobado' ya registró su pago en la cuenta corriente
--     (id_pago IS NOT NULL), el turno puede generar un nuevo QR por el saldo restante.

DROP INDEX IF EXISTS public.cobros_mercadopago_turno_activo_uidx;

CREATE UNIQUE INDEX IF NOT EXISTS cobros_mercadopago_turno_activo_uidx
  ON public.cobros_mercadopago (id_turno)
  WHERE id_turno IS NOT NULL AND (estado = 'Pendiente' OR (estado = 'Aprobado' AND id_pago IS NULL));
