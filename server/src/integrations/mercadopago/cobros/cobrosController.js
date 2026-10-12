import { responderErrorServicio } from '../../../utils/solicitudesVisita.js';
import * as service from './cobrosService.js';
import { procesarWebhook } from './webhookService.js';

// Ownership always comes from the JWT (req.user.sub), never from the body.
const conUsuario = (handler) => async (req, res) => {
  const idUsuario = Number(req.user?.sub);
  if (!Number.isInteger(idUsuario) || idUsuario <= 0) {
    return res.status(401).json({ ok: false, error: 'No autenticado' });
  }
  try {
    return await handler(req, res, idUsuario);
  } catch {
    return res.status(500).json({ ok: false, error: 'Error interno del servidor.' });
  }
};

export const crear = conUsuario(async (req, res, idUsuario) => {
  const r = await service.crearCobro(idUsuario, req.body ?? {});
  if (r.error) return responderErrorServicio(res, r.error);
  return res.status(201).json({ ok: true, data: r.data });
});

export const listar = conUsuario(async (req, res, idUsuario) => {
  const r = await service.listarCobros(idUsuario, req.query.id_solicitud);
  if (r.error) return responderErrorServicio(res, r.error);
  return res.json({ ok: true, data: r.data });
});

export const obtener = conUsuario(async (req, res, idUsuario) => {
  const r = await service.obtenerCobro(req.params.id, idUsuario);
  if (r.error) return responderErrorServicio(res, r.error);
  return res.json({ ok: true, data: r.data });
});

export const qr = conUsuario(async (req, res, idUsuario) => {
  const r = await service.obtenerQrPng(req.params.id, idUsuario);
  if (r.error) return responderErrorServicio(res, r.error);
  res.set('Cache-Control', 'no-store');
  return res.type('image/png').send(r.data);
});

export const cancelar = conUsuario(async (req, res, idUsuario) => {
  const r = await service.cancelarCobro(req.params.id, idUsuario);
  if (r.error) return responderErrorServicio(res, r.error);
  return res.json({ ok: true, data: r.data });
});

// Public: called by Mercado Pago, authenticated only by the x-signature check.
export const webhook = async (req, res) => {
  try {
    const { status } = await procesarWebhook({ headers: req.headers, query: req.query, body: req.body });
    if (status === 503) {
      return res.status(503).json({ ok: false, error: 'Servicio no disponible.' });
    }
    if (status === 401) return res.status(401).json({ ok: false, error: 'Firma inválida.' });
    return res.sendStatus(status);
  } catch {
    return res.sendStatus(500);
  }
};
