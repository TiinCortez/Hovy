import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { previsualizarQr } from './qrPlantillaController.js';

// Image composition is CPU-heavy: cap it per IP (behind JWT + admin role).
const qrRateLimit = rateLimit({
  windowMs: Number(process.env.QR_RATE_LIMIT_WINDOW_MS) || 60_000,
  limit: Number(process.env.QR_RATE_LIMIT_MAX) || 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) =>
    res.status(429).json({
      ok: false,
      error: 'Demasiados pedidos. Probá de nuevo en un momento.',
    }),
});

const router = Router();

// POST /api/qr/previsualizar
router.post('/previsualizar', qrRateLimit, previsualizarQr);

export default router;
