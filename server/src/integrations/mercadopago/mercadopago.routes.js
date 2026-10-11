import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { authMiddleware, requireRole } from '../../middleware/authMiddleware.js';
import * as controller from './mercadopagoOAuthController.js';

const oauthRateLimit = rateLimit({
  windowMs: Number(process.env.MERCADOPAGO_RATE_LIMIT_WINDOW_MS) || 900_000,
  limit: Number(process.env.MERCADOPAGO_RATE_LIMIT_MAX) || 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) =>
    res.status(429).json({ ok: false, error: 'Demasiados intentos. Probá de nuevo más tarde.' }),
});

const adminOnly = [authMiddleware, requireRole(['admin'])];

// Public router: the callback is hit by the browser coming from Mercado Pago, no JWT.
// Mounted in app.js BEFORE/outside the authenticated mounts.
export const mercadopagoPublicRouter = Router();
mercadopagoPublicRouter.get('/oauth/callback', oauthRateLimit, controller.callback);

// Authenticated router (JWT + admin), mounted at /api/mercadopago.
export const mercadopagoAdminRouter = Router();
mercadopagoAdminRouter.post('/oauth/iniciar', oauthRateLimit, ...adminOnly, controller.iniciar);
mercadopagoAdminRouter.get('/conexion', ...adminOnly, controller.conexion);
// Local unlink only; remote revocation at Mercado Pago is out of scope.
mercadopagoAdminRouter.delete('/conexion', ...adminOnly, controller.desconectar);
