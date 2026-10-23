import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import * as controller from '../controllers/combustibleController.js';

export const combustibleRateLimit = rateLimit({
  windowMs: 60_000,
  limit: Number(process.env.COMBUSTIBLE_RATE_LIMIT_MAX) || 60,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) =>
    res.status(429).json({ ok: false, error: 'Demasiados pedidos. Probá de nuevo en un momento.' }),
});

// JWT + admin are applied in app.js, mounted at /api/combustible.
const router = Router();
// The rate limit is applied where the router is mounted in app.js (CodeQL looks for it there).
router.get('/ciudades', controller.ciudades);
router.get('/precios', controller.precios);
router.get('/traslado', controller.traslado);
router.get('/config', controller.obtenerConfig);
router.put('/config', controller.guardarConfig);

export default router;
