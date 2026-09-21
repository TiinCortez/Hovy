import { rateLimit, ipKeyGenerator } from 'express-rate-limit';

// Límite sobre los endpoints del bot que disparan un envío de mail (alta,
// cambio de email y recuperación). A diferencia de emailRateLimit, acá NO
// conviene limitar por IP: todo el tráfico del bot llega desde la IP de n8n,
// así que un límite por IP terminaría siendo un cupo compartido entre todos
// los clientes reales. Se limita por el dato que identifica a quien escribe
// (telefono en la URL o en el body del alta, identificador en la
// recuperación), así uno que insiste no le come cupo a los demás.
const windowMs = Number(process.env.EMAIL_RATE_LIMIT_WINDOW_MS) || 3_600_000;
const limit = Number(process.env.EMAIL_RATE_LIMIT_MAX) || 5;

export const clienteEmailRateLimit = rateLimit({
  windowMs,
  limit,
  standardHeaders: true,
  legacyHeaders: false,
  // ipKeyGenerator normaliza la IP de respaldo (una IPv6 se puede escribir de
  // varias formas equivalentes; sin normalizar, alguien podría saltarse el
  // límite escribiéndola distinto cada vez). Solo aplica al caso raro sin
  // telefono ni identificador.
  keyGenerator: (req) =>
    req.params?.telefono || req.body?.telefono || req.body?.identificador || ipKeyGenerator(req.ip),
  handler: (req, res) =>
    res.status(429).json({
      ok: false,
      error: 'Demasiados intentos. Probá de nuevo más tarde.',
    }),
});
