import { responderErrorServicio } from '../utils/solicitudesVisita.js';
import * as service from '../services/salidaService.js';

// Ownership always comes from the JWT (sub), never from the body.
const idUsuarioDelToken = (req) => {
  const id = Number(req.user?.sub);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const responder = (res, resultado) =>
  resultado.error
    ? responderErrorServicio(res, resultado.error)
    : res.status(200).json({ ok: true, data: resultado.data });

const conUsuario = (handler) => async (req, res) => {
  const idUsuario = idUsuarioDelToken(req);
  if (!idUsuario) return res.status(401).json({ ok: false, error: 'No se pudo identificar al usuario.' });
  return responder(res, await handler(idUsuario, req));
};

// GET /api/perfil/salida
export const obtener = conUsuario((idUsuario) => service.obtenerSalida(idUsuario));

// POST /api/perfil/salida/sugerencia  { latitud, longitud }
// Approximate address of the browser's position, to be confirmed. Saves nothing.
export const sugerencia = async (req, res) => responder(res, await service.sugerirSalida(req.body));

// PUT /api/perfil/salida  { latitud, longitud, domicilio? }
// Called only after the user confirmed the location in the UI.
export const guardar = conUsuario((idUsuario, req) => service.guardarSalida(idUsuario, req.body));

// DELETE /api/perfil/salida
export const quitar = conUsuario((idUsuario) => service.quitarSalida(idUsuario));
