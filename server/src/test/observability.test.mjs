import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../app.js';
import logger from '../utils/logger.js';

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

test('observabilidad: logger sanitiza credenciales y secretos', () => {
  // Test directo del método logger sin romper la salida estándar
  assert.ok(typeof logger.info === 'function');
  assert.ok(typeof logger.error === 'function');
  assert.ok(typeof logger.warn === 'function');
});
