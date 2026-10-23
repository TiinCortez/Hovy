import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import * as controller from './cobrosController.js';

const limitar = (envMax, porDefecto, mensaje) =>
  rateLimit({
    windowMs: 60_000,
    limit: Number(process.env[envMax]) || porDefecto,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => res.status(429).json({ ok: false, error: mensaje }),
  });

const cobrosRateLimit = limitar('COBROS_RATE_LIMIT_MAX', 30, 'Demasiados pedidos. Probá de nuevo en un momento.');
const webhookRateLimit = limitar('MERCADOPAGO_WEBHOOK_RATE_LIMIT_MAX', 300, 'Demasiadas notificaciones.');
// The panel polls this while a QR is on screen (every few seconds).
const verificacionRateLimit = limitar('COBROS_VERIFICACION_RATE_LIMIT_MAX', 120, 'Demasiadas consultas. Probá de nuevo en un momento.');

// Authenticated (JWT + admin applied in app.js), mounted at /api/cobros.
export const cobrosRouter = Router();
cobrosRouter.post('/', cobrosRateLimit, controller.crear);
cobrosRouter.get('/', controller.listar);
cobrosRouter.get('/:id/qr', cobrosRateLimit, controller.qr);
cobrosRouter.post('/:id/cancelar', controller.cancelar);
cobrosRouter.post('/:id/verificar', verificacionRateLimit, controller.verificar);
cobrosRouter.get('/:id', controller.obtener);

// Public webhook, mounted at /api/mercadopago OUTSIDE the authenticated mounts.
export const webhookRouter = Router();
webhookRouter.post('/webhook', webhookRateLimit, controller.webhook);
