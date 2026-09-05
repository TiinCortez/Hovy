import { rateLimit } from 'express-rate-limit';
import dotenv from 'dotenv';

dotenv.config();

// Límite de volumen para todo el router del bot.
//
// La API key es un secreto, y los secretos se filtran (un log, un screenshot,
// un commit). La pregunta no es si puede pasar, sino qué puede hacer alguien en
// los primeros minutos. Sin límite: bajarse la tabla de clientes entera.
//
// De paso cubre el caso más probable: un nodo de n8n mal armado en loop
// disparando miles de requests contra Supabase.

const windowMs = Number(process.env.BOT_RATE_LIMIT_WINDOW_MS) || 60_000;
const limit = Number(process.env.BOT_RATE_LIMIT_MAX) || 120;

export const botRateLimit = rateLimit({
  windowMs,
  limit,

  // express-rate-limit cuenta por IP por defecto, y acá eso no sirve: todo el
  // tráfico llega desde la misma IP (la de n8n), así que un límite por IP o es
  // tan alto que no protege, o corta al bot entero. Con una clave fija el
  // límite pasa a ser un cupo global del router, que es lo que queremos.
  keyGenerator: () => 'bot',

  standardHeaders: true,
  legacyHeaders: false,

  // El default de la librería responde texto plano; mantenemos el shape
  // { ok, error } que usa el resto de la API.
  handler: (req, res) =>
    res.status(429).json({
      ok: false,
      error: 'Demasiadas peticiones. Intentá de nuevo en unos instantes.',
    }),
});
