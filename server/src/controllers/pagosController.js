import { responderErrorServicio } from '../utils/solicitudesVisita.js';
import { registrarPagoTurno } from '../services/pagoManualService.js';

// POST /api/turnos/:id/pagos  { medio: 'Efectivo' | 'Transferencia', monto, referencia? }
// Registers a payment received by hand for a Realizado turno. Ownership of the
// registration comes from the JWT (sub), never from the body.
export const registrarPago = async (req, res) => {
  const idUsuario = Number(req.user?.sub);
  if (!Number.isInteger(idUsuario) || idUsuario <= 0) {
    return res.status(401).json({ ok: false, error: 'No se pudo identificar al usuario.' });
  }

  const resultado = await registrarPagoTurno({ idUsuario, idTurno: req.params.id, body: req.body });
  if (resultado.error) return responderErrorServicio(res, resultado.error);

  return res.status(201).json({ ok: true, data: resultado.data });
};
