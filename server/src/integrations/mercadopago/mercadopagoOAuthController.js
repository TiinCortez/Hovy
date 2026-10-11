import * as service from './mercadopagoOAuthService.js';

const sendError = (res, error) =>
  res.status(error.status).json({ ok: false, error: error.message });

const getUserId = (req) => {
  const id = Number(req.user?.sub);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const withUser = (handler) => async (req, res) => {
  const idUsuario = getUserId(req);
  if (!idUsuario) return res.status(401).json({ ok: false, error: 'No autenticado' });
  try {
    return await handler(req, res, idUsuario);
  } catch {
    return res.status(500).json({ ok: false, error: 'Error interno del servidor.' });
  }
};

export const iniciar = withUser(async (req, res, idUsuario) => {
  const result = await service.iniciarAutorizacion(idUsuario);
  if (result.error) return sendError(res, result.error);
  return res.json({ ok: true, data: result.data });
});

export const conexion = withUser(async (req, res, idUsuario) => {
  const result = await service.obtenerConexion(idUsuario);
  if (result.error) return sendError(res, result.error);
  return res.json({ ok: true, data: result.data });
});

export const desconectar = withUser(async (req, res, idUsuario) => {
  const result = await service.desconectar(idUsuario);
  if (result.error) return sendError(res, result.error);
  return res.json({ ok: true });
});

// Public: reached by the browser coming back from Mercado Pago (no JWT).
// Always answers with a 302 to the client; tokens/codes never appear in the URL.
export const callback = async (req, res) => {
  const base = process.env.MERCADOPAGO_POST_CONNECT_URL;
  if (!base) {
    return res.status(503).type('text/plain').send('La integración con Mercado Pago no está configurada.');
  }

  let motivo = 'interno';
  try {
    const { code, state, error } = req.query;
    const result = await service.procesarCallback({ code, state, error });
    if (result.ok) motivo = null;
    else motivo = result.motivo;
  } catch {
    motivo = 'interno';
  }

  let target;
  try {
    target = new URL(base);
  } catch {
    return res.status(503).type('text/plain').send('La integración con Mercado Pago no está configurada.');
  }
  if (motivo) {
    target.searchParams.set('mercadopago', 'error');
    target.searchParams.set('motivo', motivo);
  } else {
    target.searchParams.set('mercadopago', 'conectado');
  }
  return res.redirect(302, target.toString());
};
