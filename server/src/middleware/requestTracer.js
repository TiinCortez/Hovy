/**
 * requestTracer.js
 * Middleware de observabilidad y trazabilidad HTTP.
 * 
 * 1. Asigna o propaga una cabecera 'x-request-id' única por petición.
 * 2. Mide la latencia de respuesta en milisegundos.
 * 3. Emite un log estructurado al finalizar la respuesta.
 */

import crypto from 'node:crypto';
import logger from '../utils/logger.js';

// Decides whether a finished request is logged.
//  - Errors (4xx / 5xx) are always logged.
//  - The healthcheck and the CORS preflight (OPTIONS) are noise when they succeed.
//  - Successful requests are logged in production (observability) but not in
//    development: the web panel polls the API every minute per open tab, which
//    buries the lines that matter. LOG_HTTP=all brings them back.
export function debeRegistrarRequest(
  { method, path, statusCode },
  { production = process.env.NODE_ENV === 'production', logAll = process.env.LOG_HTTP === 'all' } = {}
) {
  if (statusCode >= 400) return true;
  if (path === '/api/health') return false;
  if (logAll) return true;
  if (method === 'OPTIONS') return false;
  return production;
}

export function requestTracer(req, res, next) {
  // Usar cabecera entrante (Cloudflare Ray ID o x-request-id) o generar nuevo UUID
  const requestId = req.headers['x-request-id'] || req.headers['cf-ray'] || crypto.randomUUID();
  req.id = requestId;
  res.setHeader('x-request-id', requestId);

  const startTime = Date.now();

  res.on('finish', () => {
    if (!debeRegistrarRequest({ method: req.method, path: req.path, statusCode: res.statusCode })) {
      return;
    }

    const durationMs = Date.now() - startTime;
    const logData = {
      requestId,
      method: req.method,
      path: req.originalUrl || req.path,
      statusCode: res.statusCode,
      durationMs,
      ip: req.ip || req.socket.remoteAddress,
      userAgent: req.headers['user-agent']
    };

    if (res.statusCode >= 500) {
      logger.error(`HTTP ${req.method} ${req.path} finalizó con error del servidor`, logData);
    } else if (res.statusCode >= 400) {
      logger.warn(`HTTP ${req.method} ${req.path} finalizó con error del cliente`, logData);
    } else {
      logger.info(`HTTP ${req.method} ${req.path} completado`, logData);
    }
  });

  next();
}

export default requestTracer;
