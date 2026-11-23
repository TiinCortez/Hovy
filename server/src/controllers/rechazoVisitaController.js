import { ERROR_ID_SOLICITUD_INVALIDO, parsearIdSolicitud, responderErrorServicio } from '../utils/solicitudesVisita.js';
import { rechazarVisita } from '../services/rechazoVisitaService.js';

// POST /api/visitas/:id/rechazar   body: { motivo? }
// Pendiente / Contactada of a new contact -> Rechazada. See rechazarVisita.
// The third argument only exists for tests (express passes `next` there).
export const rechazarSolicitudVisita = async (req, res, deps) => {
  const rechazar = typeof deps?.rechazar === 'function' ? deps.rechazar : rechazarVisita;

  const idSolicitud = parsearIdSolicitud(req.params.id);
  if (!idSolicitud) {
    return res.status(400).json({ ok: false, error: ERROR_ID_SOLICITUD_INVALIDO });
  }

  try {
    const resultado = await rechazar({ idSolicitud, idUsuario: req.usuario?.id, body: req.body ?? {} });
    if (resultado.error) return responderErrorServicio(res, resultado.error);

    const { solicitud, rechazada, sesionBorrada, aviso } = resultado;
    return res.status(200).json({
      ok: true,
      mensaje: `La solicitud de ${solicitud.nombre} ${solicitud.apellido} quedó rechazada.`,
      data: rechazada,
      sesion_borrada: sesionBorrada,
      aviso_enviado: aviso.enviado,
      aviso_motivo: aviso.motivo,
    });
  } catch (err) {
    console.error('Error inesperado al rechazar la solicitud de visita:', err);
    return res.status(500).json({ ok: false, error: 'Ocurrió un error inesperado al rechazar la solicitud.' });
  }
};
