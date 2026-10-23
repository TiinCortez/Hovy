import { responderErrorServicio } from '../utils/solicitudesVisita.js';
import { resolverFechaConsulta } from '../utils/fechaArgentina.js';
import { armarMensajeLogistica } from '../utils/rutaDia.js';
import { obtenerLogisticaDia } from '../services/logisticaService.js';

// Logistics of a day (turnos, clients, route, fuel). Two doors to the same
// service: the web panel (JWT) and the WhatsApp bot (identity from the phone
// number). Read-only, and the answer never carries coordinates.

const responder = async (req, res, idUsuario, { conMensaje }) => {
  const fecha = resolverFechaConsulta(req.query?.fecha);
  if (fecha.error) return res.status(400).json({ ok: false, error: fecha.error });

  const resultado = await obtenerLogisticaDia({ idUsuario, fecha: fecha.fecha });
  if (resultado.error) return responderErrorServicio(res, resultado.error);

  // The bot gets a plain-text summary ready to forward in the chat.
  return res.status(200).json({
    ok: true,
    data: resultado.data,
    ...(conMensaje ? { mensaje: armarMensajeLogistica(resultado.data) } : {}),
  });
};

// GET /api/logistica/dia?fecha=YYYY-MM-DD  (JWT + admin; sin fecha, hoy)
// Ownership always comes from the JWT (sub), never from the query.
export const logisticaDia = async (req, res) => {
  const idUsuario = Number(req.user?.sub);
  if (!Number.isInteger(idUsuario) || idUsuario <= 0) {
    return res.status(401).json({ ok: false, error: 'No se pudo identificar al usuario.' });
  }
  return responder(req, res, idUsuario, { conMensaje: false });
};

// GET /api/bot/staff/:telefono/logistica?fecha=YYYY-MM-DD
// req.usuario already comes resolved by resolverStaffPorTelefono (team member
// with admin role): the departure point and the fuel are that person's.
export const logisticaStaff = async (req, res) => responder(req, res, req.usuario.id, { conMensaje: true });
