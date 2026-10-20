/**
 * logger.js
 * Logger estructurado para Hovy.
 * 
 * En producción (NODE_ENV=production):
 *   Genera logs en formato JSON estructurado por línea (compatible con BetterStack,
 *   Grafana Loki, Datadog y el driver json-file de Docker).
 * En desarrollo/test:
 *   Genera salidas legibles en consola con timestamps y niveles.
 * 
 * Sanitiza automáticamente campos sensibles (tokens, contraseñas, secretos).
 */

const isProduction = process.env.NODE_ENV === 'production';
const SERVICE_NAME = 'hovy-api';

const SENSITIVE_KEYS = new Set([
  'password',
  'token',
  'access_token',
  'refresh_token',
  'secret',
  'webhook_secret',
  'authorization',
  'cookie',
  'x-api-key'
]);

function sanitizeMeta(meta) {
  if (!meta || typeof meta !== 'object') return meta;
  if (Array.isArray(meta)) return meta.map(sanitizeMeta);

  const clean = {};
  for (const [key, val] of Object.entries(meta)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      clean[key] = '***REDACTED***';
    } else if (typeof val === 'object' && val !== null) {
      clean[key] = sanitizeMeta(val);
    } else {
      clean[key] = val;
    }
  }
  return clean;
}

function formatOutput(level, message, meta = {}) {
  const timestamp = new Date().toISOString();
  const cleanMeta = sanitizeMeta(meta);

  if (isProduction) {
    return JSON.stringify({
      timestamp,
      level,
      service: SERVICE_NAME,
      message,
      ...(typeof cleanMeta === 'object' ? cleanMeta : { details: cleanMeta })
    });
  }

  const metaStr = Object.keys(cleanMeta).length > 0 ? ` ${JSON.stringify(cleanMeta)}` : '';
  return `[${timestamp}] [${level.toUpperCase()}] [${SERVICE_NAME}] ${message}${metaStr}`;
}

export const logger = {
  info(message, meta) {
    console.log(formatOutput('info', message, meta));
  },
  warn(message, meta) {
    console.warn(formatOutput('warn', message, meta));
  },
  error(message, meta) {
    console.error(formatOutput('error', message, meta));
  },
  debug(message, meta) {
    if (process.env.DEBUG || !isProduction) {
      console.debug(formatOutput('debug', message, meta));
    }
  }
};

export { sanitizeMeta, formatOutput };
export default logger;
