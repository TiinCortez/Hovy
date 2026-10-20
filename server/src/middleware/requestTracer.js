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

export function requestTracer(req, res, next) {
  // Usar cabecera entrante (Cloudflare Ray ID o x-request-id) o generar nuevo UUID
  const requestId = req.headers['x-request-id'] || req.headers['cf-ray'] || crypto.randomUUID();
  req.id = requestId;
  res.setHeader('x-request-id', requestId);

  const startTime = Date.now();

  res.on('finish', () => {
    // No saturar logs con healthchecks periódicos a menos que den error
    if (req.path === '/api/health' && res.statusCode === 200) {
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
