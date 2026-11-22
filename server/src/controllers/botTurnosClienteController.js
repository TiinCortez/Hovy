import { responderErrorServicio } from '../utils/solicitudesVisita.js';
import {
  obtenerTurnosFuturosCliente,
  confirmarTurnoDelCliente,
  cancelarTurnoDelCliente,
} from '../services/turnosClienteService.js';

// GET /api/bot/clientes/:telefono/turnos?limite=20
//
// Lista los turnos futuros (Coordinado, Confirmado, En ejecución) de todos los
// inmuebles pertenecientes al cliente identificado por el teléfono en la URL.
export const getTurnosFuturosDelCliente = async (req, res) => {
  try {
    const resultado = await obtenerTurnosFuturosCliente({
      idCliente: req.cliente?.id_cliente,
      limite: req.query?.limite,
    });

    if (resultado.error) return responderErrorServicio(res, resultado.error);

    return res.status(200).json({
      ok: true,
      total: resultado.data.length,
      data: resultado.data,
      mensaje: resultado.mensaje,
    });
  } catch (err) {
    console.error('Error inesperado al consultar los turnos futuros del cliente:', err);
    return res.status(500).json({
      ok: false,
      error: 'Ocurrió un error inesperado al consultar los turnos.',
    });
  }
};

const textoFecha = (d) => {
  const [, mes, dia] = String(d.fecha ?? '').slice(0, 10).split('-');
  const horario = d.hora_inicio && d.hora_fin ? `, de ${d.hora_inicio} a ${d.hora_fin}` : '';
  return dia && mes ? `${dia}/${mes}${horario}` : '';
};

// POST /api/bot/clientes/:telefono/turnos/:id/confirmar
//
// El cliente tocó [Confirmar] en el aviso del turno: Coordinado -> Confirmado.
// Idempotente. Solo opera sobre turnos del cliente identificado por el teléfono.
export const confirmarTurnoCliente = async (req, res) => {
  try {
    const resultado = await confirmarTurnoDelCliente({
      idCliente: req.cliente?.id_cliente,
      idTurno: req.params.id,
    });
    if (resultado.error) return responderErrorServicio(res, resultado.error);

    const d = resultado.data;
    return res.status(200).json({
      ok: true,
      data: d,
      mensaje: d.ya_aplicado
        ? 'Ese turno ya estaba confirmado.'
        : `Turno confirmado para el ${textoFecha(d)}.`,
    });
  } catch (err) {
    console.error('Error inesperado al confirmar el turno del cliente:', err);
    return res.status(500).json({ ok: false, error: 'Ocurrió un error inesperado al confirmar el turno.' });
  }
};

// POST /api/bot/clientes/:telefono/turnos/:id/cancelar
//
// El cliente confirmó la cancelación del turno: pasa a Cancelado (no se borra) y el
// horario queda libre en la agenda. Idempotente.
export const cancelarTurnoCliente = async (req, res) => {
  try {
    const resultado = await cancelarTurnoDelCliente({
      idCliente: req.cliente?.id_cliente,
      idTurno: req.params.id,
    });
    if (resultado.error) return responderErrorServicio(res, resultado.error);

    const d = resultado.data;
    return res.status(200).json({
      ok: true,
      data: d,
      mensaje: d.ya_aplicado
        ? 'Ese turno ya estaba cancelado.'
        : `Turno del ${textoFecha(d)} cancelado.`,
    });
  } catch (err) {
    console.error('Error inesperado al cancelar el turno del cliente:', err);
    return res.status(500).json({ ok: false, error: 'Ocurrió un error inesperado al cancelar el turno.' });
  }
};
