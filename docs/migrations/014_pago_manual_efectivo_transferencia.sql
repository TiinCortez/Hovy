-- =============================================================================
-- 014_pago_manual_efectivo_transferencia.sql
-- Fecha de creación: 2026-10-23
--
-- Reglas de idempotencia (Expand/Contract):
--   - Usá CREATE TABLE IF NOT EXISTS ...
--   - Usá ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...
--   - Usá CREATE INDEX IF NOT EXISTS ...
-- =============================================================================

-- Escribí tus sentencias SQL idempotentes acá abajo:

-- Pago recibido a mano (efectivo o transferencia) de un turno realizado.
--
-- NO se crea ninguna tabla nueva: `pagos` + `movimientos_cuenta` ya modelan un pago.
--   - pagos.medio_pago ya acepta 'Efectivo', 'Transferencia' y 'MercadoPago'
--     (restricción pagos_medio_pago_check, verificada en staging).
--   - pagos.referencia_comprobante (hasta 100 caracteres) guarda el número de
--     operación de una transferencia, o una nota en efectivo.
--   - Los pagos parciales ya caben: un trabajo puede tener varios créditos.
--   - cobros_mercadopago es solo para links de pago de Mercado Pago; el efectivo y
--     la transferencia no tienen link, así que no pertenecen ahí.
-- Lo único que falta es saber QUIÉN registró un pago a mano (auditoría del efectivo).
--
-- Hechos del esquema real que condicionan esto (ver migración 013):
--   - NO hay triggers sobre `pagos`.
--   - El INSERT de un movimiento dispara trg_movimiento_aplicar_saldo: nunca se toca
--     cuentas_corrientes.saldo a mano.
--   - trg_movimiento_inmutable prohíbe UPDATE y DELETE de movimientos.

-- 1. Quién registró el pago (NULL = automático, p. ej. el webhook de Mercado Pago) ---
ALTER TABLE public.pagos
  ADD COLUMN IF NOT EXISTS id_usuario_registro BIGINT REFERENCES public.usuarios (id) ON DELETE SET NULL;

-- 2. Registro atómico del pago a mano ---------------------------------------------
-- Reglas, todas dentro de una transacción y con el turno bloqueado (FOR UPDATE) para
-- que dos registros simultáneos del mismo turno se serialicen:
--   a) el medio tiene que ser Efectivo o Transferencia;
--   b) el turno tiene que estar Realizado (recién ahí existe la deuda);
--   c) el monto no puede superar lo que el cliente todavía debe de ese trabajo, según
--      el libro de movimientos: así un doble clic no acredita dos veces;
--   d) inserta el pago, su Crédito ("Pago N - Efectivo", la misma convención que ya
--      usan los pagos existentes) y los enlaza;
--   e) marca el turno como cobrado solo si ya no queda saldo del trabajo;
--   f) cancela los links de Mercado Pago pendientes del turno: su monto ya no
--      coincide con lo que se debe y pagarlos acreditaría de más.
-- Los errores de negocio se lanzan con ERRCODE P0001 y un mensaje listo para mostrar.
CREATE OR REPLACE FUNCTION public.fn_registrar_pago_turno(
  p_id_turno   INTEGER,
  p_monto      NUMERIC,
  p_medio      TEXT,
  p_referencia TEXT,
  p_id_usuario BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_turno       public.turnos%ROWTYPE;
  v_id_cliente  INTEGER;
  v_id_trabajo  INTEGER;
  v_id_cuenta   INTEGER;
  v_pendiente   NUMERIC(12, 2);
  v_restante    NUMERIC(12, 2);
  v_id_pago     INTEGER;
  v_id_mov      INTEGER;
  v_cancelados  INTEGER;
BEGIN
  IF p_medio IS NULL OR p_medio NOT IN ('Efectivo', 'Transferencia') THEN
    RAISE EXCEPTION 'El medio de pago tiene que ser Efectivo o Transferencia.' USING ERRCODE = 'P0001';
  END IF;

  IF p_monto IS NULL OR p_monto <= 0 THEN
    RAISE EXCEPTION 'El monto tiene que ser mayor a 0.' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_turno FROM public.turnos WHERE id_turno = p_id_turno FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No existe un turno con ese id.' USING ERRCODE = 'P0001';
  END IF;

  IF v_turno.estado <> 'Realizado' THEN
    RAISE EXCEPTION 'El turno tiene que estar Realizado para registrar un pago (estado actual: %).', v_turno.estado
      USING ERRCODE = 'P0001';
  END IF;

  SELECT id_trabajo INTO v_id_trabajo FROM public.trabajos_ejecutados WHERE id_turno = p_id_turno;

  IF v_id_trabajo IS NULL THEN
    RAISE EXCEPTION 'El turno no tiene un trabajo registrado: no hay deuda para cobrar.' USING ERRCODE = 'P0001';
  END IF;

  SELECT i.id_cliente INTO v_id_cliente FROM public.inmuebles i WHERE i.id_inmueble = v_turno.id_inmueble;

  IF v_id_cliente IS NULL THEN
    SELECT p.id_cliente INTO v_id_cliente FROM public.presupuestos p WHERE p.id_presupuesto = v_turno.id_presupuesto;
  END IF;

  SELECT id_cuenta INTO v_id_cuenta FROM public.cuentas_corrientes WHERE id_cliente = v_id_cliente;

  IF v_id_cuenta IS NULL THEN
    RAISE EXCEPTION 'El cliente no tiene cuenta corriente: no hay deuda para cobrar.' USING ERRCODE = 'P0001';
  END IF;

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
    RAISE EXCEPTION 'Este turno no tiene saldo pendiente de cobro.' USING ERRCODE = 'P0001';
  END IF;

  IF p_monto > v_pendiente THEN
    RAISE EXCEPTION 'El pago (%) supera lo que el cliente todavía debe de este trabajo (%).', p_monto, v_pendiente
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.pagos (id_cliente, id_trabajo, monto, medio_pago, referencia_comprobante, estado, id_usuario_registro)
  VALUES (
    v_id_cliente,
    v_id_trabajo,
    p_monto,
    p_medio,
    COALESCE(NULLIF(left(btrim(COALESCE(p_referencia, '')), 100), ''), p_medio || ' - turno ' || p_id_turno),
    'Aprobado',
    p_id_usuario
  )
  RETURNING id_pago INTO v_id_pago;

  -- El trigger trg_movimiento_aplicar_saldo ajusta el saldo de la cuenta.
  INSERT INTO public.movimientos_cuenta (id_cuenta, tipo, monto, concepto, id_presupuesto, id_trabajo)
  VALUES (v_id_cuenta, 'Credito', p_monto, 'Pago ' || v_id_pago || ' - ' || p_medio, v_turno.id_presupuesto, v_id_trabajo)
  RETURNING id_movimiento INTO v_id_mov;

  UPDATE public.pagos SET id_movimiento = v_id_mov WHERE id_pago = v_id_pago;

  v_restante := v_pendiente - p_monto;

  IF v_restante <= 0 THEN
    UPDATE public.turnos SET cobrado = TRUE WHERE id_turno = p_id_turno;
  END IF;

  UPDATE public.cobros_mercadopago
  SET estado = 'Cancelado', updated_at = now()
  WHERE id_turno = p_id_turno AND estado = 'Pendiente';

  GET DIAGNOSTICS v_cancelados = ROW_COUNT;

  RETURN jsonb_build_object(
    'registrado', true,
    'id_pago', v_id_pago,
    'id_movimiento', v_id_mov,
    'pendiente', v_restante,
    'cobrado', v_restante <= 0,
    'cobros_cancelados', v_cancelados
  );
END;
$$;

-- Registrar un pago es una operación de dinero: solo el servidor (service role) puede
-- llamarla. Supabase expone por defecto las funciones del esquema public a anon y
-- authenticated vía /rest/v1/rpc, así que hay que quitarles el permiso.
REVOKE ALL ON FUNCTION public.fn_registrar_pago_turno(INTEGER, NUMERIC, TEXT, TEXT, BIGINT) FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION public.fn_registrar_pago_turno(INTEGER, NUMERIC, TEXT, TEXT, BIGINT) FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON FUNCTION public.fn_registrar_pago_turno(INTEGER, NUMERIC, TEXT, TEXT, BIGINT) FROM authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.fn_registrar_pago_turno(INTEGER, NUMERIC, TEXT, TEXT, BIGINT) TO service_role;
  END IF;
END $$;
