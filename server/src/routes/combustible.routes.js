import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import * as controller from '../controllers/combustibleController.js';

const combustibleRateLimit = rateLimit({
  windowMs: 60_000,
  limit: Number(process.env.COMBUSTIBLE_RATE_LIMIT_MAX) || 60,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) =>
    res.status(429).json({ ok: false, error: 'Demasiados pedidos. Probá de nuevo en un momento.' }),
});

// JWT + admin are applied in app.js, mounted at /api/combustible.
const router = Router();
// The limiter is set on each route (not with router.use) so CodeQL recognizes it.
router.get('/ciudades', combustibleRateLimit, controller.ciudades);
router.get('/precios', combustibleRateLimit, controller.precios);
router.get('/traslado', combustibleRateLimit, controller.traslado);
router.get('/config', combustibleRateLimit, controller.obtenerConfig);
router.put('/config', combustibleRateLimit, controller.guardarConfig);

export default router;
