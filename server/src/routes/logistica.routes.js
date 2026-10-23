import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import * as controller from '../controllers/logisticaController.js';

const logisticaRateLimit = rateLimit({
  windowMs: 60_000,
  limit: Number(process.env.LOGISTICA_RATE_LIMIT_MAX) || 60,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) =>
    res.status(429).json({ ok: false, error: 'Demasiados pedidos. Probá de nuevo en un momento.' }),
});

// JWT + admin are applied in app.js, mounted at /api/logistica.
const router = Router();
router.get('/dia', logisticaRateLimit, controller.logisticaDia);

export default router;
