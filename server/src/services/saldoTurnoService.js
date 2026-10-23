import { falla, parsearIdSolicitud } from '../utils/solicitudesVisita.js';
import { armarSaldoTurno } from '../utils/saldoTurno.js';
import * as repoCobros from '../integrations/mercadopago/cobros/cobrosRepository.js';

// Balance of a turno for the panel: total, what the client still owes and the
// payments registered. Read-only. The panel uses it as the default amount when
// choosing how to charge.
//
// Services never touch req/res: they return { error: { status, message } } or { data }.

const ERROR_DB = 'No se pudo completar la operación. Intentá de nuevo más tarde.';

export const obtenerSaldoTurno = async (
  idTurnoRaw,
  { leerContexto = repoCobros.leerContextoCobroTurno, listarPagos = repoCobros.listarPagosDeTrabajo } = {}
) => {
  const idTurno = parsearIdSolicitud(idTurnoRaw);
  if (!idTurno) return falla(400, 'El id del turno tiene que ser un número entero positivo.');

  const contexto = await leerContexto(idTurno);
  if (contexto.dbError) {
    console.error('[saldo] no se pudo leer el turno');
    return falla(500, ERROR_DB);
  }
  const { turno, movimientos, presupuesto, idTrabajo } = contexto.data;
  if (!turno) return falla(404, 'No existe un turno con ese id.');

  let pagos = [];
  if (idTrabajo) {
    const lectura = await listarPagos(idTrabajo);
    if (lectura.dbError) {
      console.error('[saldo] no se pudieron leer los pagos del trabajo');
      return falla(500, ERROR_DB);
    }
    pagos = lectura.data ?? [];
  }

  return { data: { id_turno: idTurno, ...armarSaldoTurno({ turno, movimientos, presupuesto, pagos }) } };
};
