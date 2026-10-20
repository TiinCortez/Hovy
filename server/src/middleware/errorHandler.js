/**
 * errorHandler.js
 * Middleware centralizado de manejo y formateo de errores para Express 5.
 * 
 * Captura excepciones no controladas, mapea códigos de error de Postgres/Supabase
 * (como P0001 de los triggers de cuenta corriente), y emite respuestas JSON limpias
 * correlacionadas con el requestId.
 */

import logger from '../utils/logger.js';

export function errorHandler(err, req, res, next) {
  const requestId = req.id || req.headers['x-request-id'] || 'no-request-id';
  let statusCode = err.status || err.statusCode || 500;
  let clientMessage = err.message || 'Error interno del servidor';

  // Manejo de errores específicos de PostgreSQL / Supabase
  if (err.code === 'P0001') {
    // Triggers de negocio (ej: trg_turno_realizado, trg_turno_cancelado)
    statusCode = 409;
    clientMessage = err.message || 'Conflicto con las reglas de negocio de la base de datos';
  } else if (err.code === '23505') {
    // Violación de restricción UNIQUE
    statusCode = 409;
    clientMessage = 'El registro ya existe en el sistema';
  } else if (err.code === '23503') {
    // Violación de clave foránea
    statusCode = 400;
    clientMessage = 'Referencia a entidad inexistente o inválida';
  } else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    clientMessage = 'Token de autenticación inválido';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    clientMessage = 'El token de sesión ha expirado';
  } else if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    statusCode = 400;
    clientMessage = 'Cuerpo de la petición JSON malformado';
  }

  // Registrar error estructurado en observabilidad
  logger.error(`Error procesando petición HTTP ${req.method} ${req.path}`, {
    requestId,
    statusCode,
    errorCode: err.code || err.name,
    errorMessage: err.message,
    stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined
  });

  res.status(statusCode).json({
    status: 'error',
    statusCode,
    error: clientMessage,
    requestId
  });
}

export default errorHandler;
