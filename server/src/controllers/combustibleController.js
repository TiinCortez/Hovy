import { responderErrorServicio } from '../utils/solicitudesVisita.js';
import * as service from '../services/combustibleService.js';

// Ownership always comes from the JWT (sub), never from the body.
const idUsuarioDelToken = (req) => {
  const id = Number(req.user?.sub);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const responder = (res, resultado, status = 200) =>
  resultado.error
    ? responderErrorServicio(res, resultado.error)
    : res.status(status).json({ ok: true, data: resultado.data });

// GET /api/combustible/ciudades
export const ciudades = async (req, res) => responder(res, await service.listarCiudades());

// GET /api/combustible/precios?ciudad=
// Without ciudad it falls back to the one saved in the user's configuration.
export const precios = async (req, res) => {
  let ciudad = req.query.ciudad;

  if (!ciudad) {
    const idUsuario = idUsuarioDelToken(req);
    if (!idUsuario) return res.status(401).json({ ok: false, error: 'No se pudo identificar al usuario.' });
    const config = await service.obtenerConfig(idUsuario);
    if (config.error) return responderErrorServicio(res, config.error);
    ciudad = config.data.ciudad;
  }

  return responder(res, await service.obtenerPrecios(ciudad));
};

// GET /api/combustible/config
export const obtenerConfig = async (req, res) => {
  const idUsuario = idUsuarioDelToken(req);
  if (!idUsuario) return res.status(401).json({ ok: false, error: 'No se pudo identificar al usuario.' });
  return responder(res, await service.obtenerConfig(idUsuario));
};

// PUT /api/combustible/config
export const guardarConfig = async (req, res) => {
  const idUsuario = idUsuarioDelToken(req);
  if (!idUsuario) return res.status(401).json({ ok: false, error: 'No se pudo identificar al usuario.' });
  return responder(res, await service.guardarConfig(idUsuario, req.body));
};
