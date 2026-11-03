import { responderErrorServicio } from '../utils/solicitudesVisita.js';
import { obtenerTurnosFuturosCliente } from '../services/turnosClienteService.js';

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
