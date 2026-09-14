import { rateLimit } from 'express-rate-limit';

// Límite por IP (a diferencia de botRateLimit, acá el tráfico sí viene de
// usuarios distintos) sobre los endpoints que disparan un envío de mail:
// register, olvide-password y reenviar-codigo. Sin esto, alguien puede
// saturar la casilla de Gmail o probar códigos de 6 dígitos a fuerza bruta
// pidiendo reenvíos sin límite.

const windowMs = Number(process.env.EMAIL_RATE_LIMIT_WINDOW_MS) || 3_600_000;
const limit = Number(process.env.EMAIL_RATE_LIMIT_MAX) || 5;

export const emailRateLimit = rateLimit({
  windowMs,
  limit,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) =>
    res.status(429).json({
      ok: false,
      error: 'Demasiados intentos. Probá de nuevo más tarde.',
    }),
});
