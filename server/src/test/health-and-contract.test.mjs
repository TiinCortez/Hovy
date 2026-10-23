import test from 'node:test';
import assert from 'node:assert/strict';

// Cliente aislado para CI/tests sin .env local: nunca toca la base real si no está definido
process.env.SUPABASE_URL ||= 'https://ci-tests.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'ci-tests-sin-conexion';
const { default: app } = await import('../app.js');

test('contrato API: /api/health devuelve telemetría completa de versión y entorno', async () => {
  const prevGitSha = process.env.GIT_SHA;
  process.env.GIT_SHA = 'abc1234';
  const server = app.listen(0);
  const port = server.address().port;

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/health`);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.status, 'ok');
    assert.equal(body.service, 'hovy-api');
    assert.equal(body.version, '1.0.0');
    assert.equal(body.commitSha, 'abc1234');
    assert.ok(typeof body.environment === 'string', 'environment debe ser string');
    assert.ok(typeof body.uptime === 'number', 'uptime debe ser number');
    assert.ok(typeof body.timestamp === 'string', 'timestamp debe ser string');
  } finally {
    if (prevGitSha === undefined) delete process.env.GIT_SHA;
    else process.env.GIT_SHA = prevGitSha;
    server.close();
  }
});

test('contrato API: /api/health?deep=true ejecuta chequeo de base de datos sin romper el servidor', async () => {
  const server = app.listen(0);
  const port = server.address().port;

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/health?deep=true`);
    // En entorno de tests puede responder 200 (si hay credenciales válidas) o 503 degraded (sin conexión),
    // pero nunca debe arrojar 500 ni crashear el proceso.
    assert.ok(res.status === 200 || res.status === 503, `HTTP status inesperado: ${res.status}`);

    const body = await res.json();
    assert.ok(body.status === 'ok' || body.status === 'degraded');
    assert.ok(body.checks, 'debe contener el objeto de checks');
    assert.ok(body.checks.database, 'debe contener el check de database');
    assert.ok(['ok', 'error', 'unreachable'].includes(body.checks.database.status));
  } finally {
    server.close();
  }
});

test('contrato API: CORS responde correctamente a orígenes autorizados', async () => {
  const server = app.listen(0);
  const port = server.address().port;

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/health`, {
      headers: {
        Origin: 'https://dev.hovyapp.com.ar'
      }
    });

    assert.equal(res.status, 200);
    assert.equal(res.headers.get('access-control-allow-origin'), 'https://dev.hovyapp.com.ar');
    assert.equal(res.headers.get('access-control-allow-credentials'), 'true');
  } finally {
    server.close();
  }
});
