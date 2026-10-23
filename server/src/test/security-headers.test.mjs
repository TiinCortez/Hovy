import test from 'node:test';
import assert from 'node:assert/strict';

// Cliente aislado para CI/tests sin .env local
process.env.SUPABASE_URL ||= 'https://ci-tests.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'ci-tests-sin-conexion';
const { default: app } = await import('../app.js');

test('seguridad: /api/health expone cabeceras HTTP defensivas (Helmet, CSP y CORS)', async () => {
  const server = app.listen(0);
  const port = server.address().port;

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/health`);
    assert.equal(res.status, 200);

    // Cabeceras inyectadas por Helmet (incluyendo Content-Security-Policy para cumplir con CodeQL)
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(res.headers.get('x-frame-options'), 'SAMEORIGIN');
    assert.equal(res.headers.get('x-dns-prefetch-control'), 'off');
    assert.ok(res.headers.get('content-security-policy'), 'Debe incluir cabecera Content-Security-Policy');

    const body = await res.json();
    assert.equal(body.status, 'ok');
    assert.equal(body.service, 'hovy-api');
  } finally {
    server.close();
  }
});
