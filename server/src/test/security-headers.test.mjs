import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../app.js';

test('seguridad: /api/health expone cabeceras HTTP defensivas (Helmet y CORS)', async () => {
  const server = app.listen(0);
  const port = server.address().port;

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/health`);
    assert.equal(res.status, 200);

    // Cabeceras inyectadas por Helmet
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(res.headers.get('x-frame-options'), 'SAMEORIGIN');
    assert.equal(res.headers.get('x-dns-prefetch-control'), 'off');

    const body = await res.json();
    assert.equal(body.status, 'ok');
    assert.equal(body.service, 'hovy-api');
  } finally {
    server.close();
  }
});
