-- =============================================================================
-- 013_cobro_por_turno_y_registro_de_pago.sql
-- Fecha de creación: 2026-10-23
--
-- Reglas de idempotencia (Expand/Contract):
--   - Usá CREATE TABLE IF NOT EXISTS ...
--   - Usá ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...
--   - Usá CREATE INDEX IF NOT EXISTS ...
-- =============================================================================

-- Escribí tus sentencias SQL idempotentes acá abajo:

-- Cobro de un turno con Mercado Pago y registro del pago en la cuenta corriente.
--
-- Hechos del esquema real (verificados en staging) que condicionan esto:
--   - NO hay ningún trigger sobre `pagos`: es solo un registro.
--   - El INSERT de un movimiento dispara trg_movimiento_aplicar_saldo, que actualiza
--     el saldo de la cuenta. Por eso acá NUNCA se toca cuentas_corrientes.saldo.
--   - trg_movimiento_inmutable prohíbe UPDATE y DELETE de movimientos_cuenta: el
--     libro es inmutable y un error se corrige con un movimiento nuevo.

-- 1. El cobro sabe a qué turno, cliente y pago corresponde ------------------------
ALTER TABLE public.cobros_mercadopago
  ADD COLUMN IF NOT EXISTS id_turno   INTEGER REFERENCES public.turnos (id_turno) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS id_cliente INTEGER REFERENCES public.clientes (id_cliente) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS id_pago    INTEGER REFERENCES public.pagos (id_pago) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS cobros_mercadopago_turno_idx
  ON public.cobros_mercadopago (id_turno);

-- Un turno no puede tener dos cobros vivos a la vez (evita cobrarlo dos veces).
CREATE UNIQUE INDEX IF NOT EXISTS cobros_mercadopago_turno_activo_uidx
  ON public.cobros_mercadopago (id_turno)
  WHERE id_turno IS NOT NULL AND estado IN ('Pendiente', 'Aprobado');

-- 2. Registro atómico e idempotente del pago aprobado ------------------------------
-- Lo llama el webhook de Mercado Pago cuando un cobro de turno queda Aprobado:
--   a) inserta el pago (medio MercadoPago, Aprobado, con el id de pago de MP);
--   b) inserta el Crédito en la cuenta corriente ("Pago N - MercadoPago", la misma
--      convención que ya usan los pagos existentes) y lo enlaza al pago;
--   c) marca el turno como cobrado solo si ya no queda saldo pendiente del trabajo;
--   d) deja el pago enlazado en el cobro.
-- Es idempotente: si el cobro ya tiene pago, no hace nada. FOR UPDATE serializa dos
-- notificaciones simultáneas del mismo pago.
CREATE OR REPLACE FUNCTION public.fn_registrar_pago_cobro(p_id_cobro BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_cobro       public.cobros_mercadopago%ROWTYPE;
  v_presupuesto INTEGER;
  v_id_trabajo  INTEGER;
  v_id_cuenta   INTEGER;
  v_id_pago     INTEGER;
  v_id_mov      INTEGER;
  v_pendiente   NUMERIC(12, 2);
BEGIN
  SELECT * INTO v_cobro
  FROM public.cobros_mercadopago
  WHERE id = p_id_cobro
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El cobro % no existe', p_id_cobro USING ERRCODE = 'P0001';
  END IF;

  IF v_cobro.id_pago IS NOT NULL THEN
    RETURN jsonb_build_object('registrado', false, 'motivo', 'ya_registrado', 'id_pago', v_cobro.id_pago);
  END IF;

  IF v_cobro.estado <> 'Aprobado' THEN
    RAISE EXCEPTION 'El cobro % no está Aprobado (estado actual: %)', p_id_cobro, v_cobro.estado
      USING ERRCODE = 'P0001';
  END IF;

  -- Cobros manuales o de una solicitud no pasan por la cuenta corriente.
  IF v_cobro.id_turno IS NULL OR v_cobro.id_cliente IS NULL THEN
    RETURN jsonb_build_object('registrado', false, 'motivo', 'sin_turno');
  END IF;

  SELECT id_presupuesto INTO v_presupuesto
  FROM public.turnos
  WHERE id_turno = v_cobro.id_turno;

  SELECT id_trabajo INTO v_id_trabajo
  FROM public.trabajos_ejecutados
  WHERE id_turno = v_cobro.id_turno;

  IF v_id_trabajo IS NULL THEN
    RETURN jsonb_build_object('registrado', false, 'motivo', 'sin_trabajo');
  END IF;

  SELECT id_cuenta INTO v_id_cuenta
  FROM public.cuentas_corrientes
  WHERE id_cliente = v_cobro.id_cliente;

  IF v_id_cuenta IS NULL THEN
    RETURN jsonb_build_object('registrado', false, 'motivo', 'sin_cuenta');
  END IF;

  INSERT INTO public.pagos (id_cliente, id_trabajo, monto, medio_pago, referencia_comprobante, estado)
  VALUES (
    v_cobro.id_cliente,
    v_id_trabajo,
    v_cobro.monto,
    'MercadoPago',
    COALESCE(v_cobro.mp_payment_id, v_cobro.external_reference),
    'Aprobado'
  )
  RETURNING id_pago INTO v_id_pago;

  -- El trigger trg_movimiento_aplicar_saldo ajusta el saldo de la cuenta.
  INSERT INTO public.movimientos_cuenta (id_cuenta, tipo, monto, concepto, id_presupuesto, id_trabajo)
  VALUES (v_id_cuenta, 'Credito', v_cobro.monto, 'Pago ' || v_id_pago || ' - MercadoPago', v_presupuesto, v_id_trabajo)
  RETURNING id_movimiento INTO v_id_mov;

  UPDATE public.pagos SET id_movimiento = v_id_mov WHERE id_pago = v_id_pago;

  -- Lo que el cliente todavía debe de este trabajo, según el libro de movimientos.
  SELECT COALESCE(SUM(
    CASE WHEN tipo IN ('Debito', 'Ajuste_Debito') THEN monto
         WHEN tipo IN ('Credito', 'Ajuste_Credito') THEN -monto
         ELSE 0 END
  ), 0)
  INTO v_pendiente
  FROM public.movimientos_cuenta
  WHERE id_trabajo = v_id_trabajo;

  IF v_pendiente <= 0 THEN
    UPDATE public.turnos SET cobrado = TRUE WHERE id_turno = v_cobro.id_turno;
  END IF;

  UPDATE public.cobros_mercadopago
  SET id_pago = v_id_pago, updated_at = now()
  WHERE id = p_id_cobro;

  RETURN jsonb_build_object(
    'registrado', true,
    'id_pago', v_id_pago,
    'id_movimiento', v_id_mov,
    'pendiente', v_pendiente,
    'cobrado', v_pendiente <= 0
  );
END;
$$;

-- Registrar un pago es una operación de dinero: solo el servidor (service role)
-- puede llamarla. Supabase expone por defecto las funciones del esquema public a
-- anon y authenticated vía /rest/v1/rpc, así que hay que quitarles el permiso.
REVOKE ALL ON FUNCTION public.fn_registrar_pago_cobro(BIGINT) FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION public.fn_registrar_pago_cobro(BIGINT) FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON FUNCTION public.fn_registrar_pago_cobro(BIGINT) FROM authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.fn_registrar_pago_cobro(BIGINT) TO service_role;
  END IF;
END $$;
