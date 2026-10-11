import { responderErrorServicio } from '../utils/solicitudesVisita.js';
import { listarServiciosActivos } from '../services/catalogoPublicoService.js';

// GET /api/bot/servicios
//
// Services the business offers (at least one active usuario_servicio), so the
// bot can show the options to a client. Only id_servicio, nombre and
// descripcion: never prices.
export const listarServiciosBot = async (req, res) => {
  try {
    const resultado = await listarServiciosActivos();
    if (resultado.error) return responderErrorServicio(res, resultado.error);

    return res.status(200).json({ ok: true, data: resultado.data });
  } catch (err) {
    console.error('Error inesperado al listar los servicios:', err);
    return res.status(500).json({
      ok: false,
      error: 'Ocurrió un error inesperado al consultar los servicios.',
    });
  }
};
