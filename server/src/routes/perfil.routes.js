import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import * as controller from '../controllers/salidaController.js';

// The suggestion calls Nominatim (public service with its own usage limits).
const sugerenciaRateLimit = rateLimit({
  windowMs: 60_000,
  limit: Number(process.env.PERFIL_SUGERENCIA_RATE_LIMIT_MAX) || 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) =>
    res.status(429).json({ ok: false, error: 'Demasiados pedidos. Probá de nuevo en un momento.' }),
});

// JWT + admin are applied in app.js, mounted at /api/perfil.
const router = Router();
router.get('/salida', controller.obtener);
router.post('/salida/sugerencia', sugerenciaRateLimit, controller.sugerencia);
router.put('/salida', controller.guardar);
router.delete('/salida', controller.quitar);

export default router;
