import { rateLimit } from 'express-rate-limit';

// Límite general de toda la API, aplicado en la raíz (`app.use('/api', ...)`) antes
// de montar las rutas. Es la red de seguridad: cada router puede sumar un límite
// más estricto para sus casos puntuales (QR, OAuth, sugerencias, etc.).
//
// Es generoso a propósito: el panel consulta cada 60 segundos y el cobro con QR
// cada 5, así que un uso normal queda muy por debajo.
//
// Cuenta por IP. Detrás del proxy de staging/producción hace falta
// `app.set('trust proxy', 1)` (ya configurado en app.js), o todos los usuarios
// compartirían el mismo contador.

// Los dos canales que llegan desde servicios y no desde personas ya tienen su
// propio cupo y no se tienen que cortar por un límite general:
//  - /bot: todo el tráfico sale de la misma IP (n8n); tiene su cupo en botRateLimit.
//  - /mercadopago/webhook: Mercado Pago reintenta; un corte perdería pagos.
// `path` es relativo al montaje en /api.
const RUTAS_PROPIAS = /^\/(bot(\/|$)|mercadopago\/webhook(\/|$))/;

export const debeOmitirRateLimit = (path) => RUTAS_PROPIAS.test(path);

export const crearApiRateLimit = ({
  windowMs = Number(process.env.API_RATE_LIMIT_WINDOW_MS) || 60_000,
  limit = Number(process.env.API_RATE_LIMIT_MAX) || 300,
} = {}) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => debeOmitirRateLimit(req.path),
    // Mantiene el formato { ok, error } del resto de la API.
    handler: (req, res) =>
      res.status(429).json({ ok: false, error: 'Demasiados pedidos. Probá de nuevo en un momento.' }),
  });

export const apiRateLimit = crearApiRateLimit();
