import { supabaseAdmin } from '../config/supabase.js';
import { falla, parsearIdSolicitud } from '../utils/solicitudesVisita.js';
import { validarPagoManual } from '../utils/pagoManual.js';

// Registers a cash or bank transfer payment of a finished turno in the client's
// account. The rules live in the database function fn_registrar_pago_turno
// (migration 014), which runs atomically: the turno has to be Realizado, the amount
// cannot exceed what the client still owes for that job (so a double click cannot
// credit twice), and any pending Mercado Pago link of the turno is cancelled so it
// is not paid on top. The ledger is immutable: a mistake is fixed with a new
// movement, not by deleting this one.
//
// Services never touch req/res: they return { error: { status, message } } or { data }.

const ERROR_DB = 'No se pudo completar la operación. Intentá de nuevo más tarde.';

// Replaceable in tests.
const rpcPorDefecto = (nombre, parametros) => supabaseAdmin.rpc(nombre, parametros);

export const registrarPagoTurno = async ({ idUsuario, idTurno, body }, { rpc = rpcPorDefecto } = {}) => {
  const id = parsearIdSolicitud(idTurno);
  if (!id) return falla(400, 'El id del turno tiene que ser un número entero positivo.');

  const validacion = validarPagoManual(body);
  if (validacion.error) return validacion;
  const { medio, monto, referencia } = validacion.valores;

  try {
    const { data, error } = await rpc('fn_registrar_pago_turno', {
      p_id_turno: id,
      p_monto: monto,
      p_medio: medio,
      p_referencia: referencia,
      p_id_usuario: idUsuario,
    });

    if (error) {
      // The function raises P0001 with a message ready to show for business rules.
      if (error.code === 'P0001') return falla(409, error.message);
      console.error('[pagos] no se pudo registrar el pago del turno');
      return falla(500, ERROR_DB);
    }

    return { data: { ...data, medio } };
  } catch (error) {
    console.error('[pagos] error inesperado al registrar el pago del turno:', error.message);
    return falla(500, ERROR_DB);
  }
};
