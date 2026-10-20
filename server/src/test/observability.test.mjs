import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../app.js';
import logger, { sanitizeMeta } from '../utils/logger.js';
import errorHandler from '../middleware/errorHandler.js';

test('observabilidad: /api/health genera automáticamente una cabecera x-request-id', async () => {
  const server = app.listen(0);
  const port = server.address().port;

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/health`);
    assert.equal(res.status, 200);

    const requestId = res.headers.get('x-request-id');
    assert.ok(requestId, 'Debe devolver cabecera x-request-id');
    assert.ok(requestId.length > 10, 'El request-id debe ser un identificador válido');
  } finally {
    server.close();
  }
});

test('observabilidad: /api/health propaga el x-request-id enviado por el cliente o Cloudflare', async () => {
  const server = app.listen(0);
  const port = server.address().port;
  const customId = 'req-trace-test-12345-abc';

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/health`, {
      headers: {
        'x-request-id': customId
      }
    });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('x-request-id'), customId);
  } finally {
    server.close();
  }
});

test('observabilidad: logger sanitiza credenciales y secretos en objetos anidados', () => {
  assert.ok(typeof logger.info === 'function');
  const limpio = sanitizeMeta({
    usuario: 'admin',
    password: 'mi-clave-secreta-123',
    headers: {
      Authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9',
      'x-api-key': 'bot-key-secreta'
    },
    webhook_secret: 'mp-secret'
  });

  assert.equal(limpio.usuario, 'admin');
  assert.equal(limpio.password, '***REDACTED***');
  assert.equal(limpio.headers.Authorization, '***REDACTED***');
  assert.equal(limpio.headers['x-api-key'], '***REDACTED***');
  assert.equal(limpio.webhook_secret, '***REDACTED***');
});

test('observabilidad: errorHandler mapea código PostgreSQL P0001 a HTTP 409 con requestId', () => {
  const err = new Error('El presupuesto no está en estado Aceptado');
  err.code = 'P0001';

  const req = {
    id: 'req-p0001-test',
    method: 'POST',
    path: '/api/turnos/7/finalizar',
    headers: {}
  };

  let capturedStatus = null;
  let capturedBody = null;
  const res = {
    status(code) {
      capturedStatus = code;
      return this;
    },
    json(payload) {
      capturedBody = payload;
      return this;
    }
  };

  errorHandler(err, req, res, () => {});

  assert.equal(capturedStatus, 409);
  assert.equal(capturedBody.status, 'error');
  assert.equal(capturedBody.statusCode, 409);
  assert.equal(capturedBody.error, 'El presupuesto no está en estado Aceptado');
  assert.equal(capturedBody.requestId, 'req-p0001-test');
});

test('observabilidad: JSON malformado en petición HTTP devuelve 400 limpio con requestId', async () => {
  const server = app.listen(0);
  const port = server.address().port;

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-request-id': 'req-bad-json-99'
      },
      body: '{"usuario": "admin", "password": '
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.status, 'error');
    assert.equal(body.requestId, 'req-bad-json-99');
    assert.match(body.error, /JSON malformado/i);
  } finally {
    server.close();
  }
});
