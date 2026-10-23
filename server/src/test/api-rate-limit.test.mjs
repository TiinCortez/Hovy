import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { crearApiRateLimit, debeOmitirRateLimit } from '../middleware/apiRateLimit.js';

test('omite el bot y el webhook de Mercado Pago, que tienen su propio cupo', () => {
  assert.equal(debeOmitirRateLimit('/bot/clientes/123'), true);
  assert.equal(debeOmitirRateLimit('/bot'), true);
  assert.equal(debeOmitirRateLimit('/mercadopago/webhook'), true);
});

test('no omite el resto de la API', () => {
  assert.equal(debeOmitirRateLimit('/turnos'), false);
  assert.equal(debeOmitirRateLimit('/cobros/5/qr'), false);
  assert.equal(debeOmitirRateLimit('/mercadopago/oauth/callback'), false);
  assert.equal(debeOmitirRateLimit('/botanica'), false);
});

// Mounts the limiter on a tiny app and returns the status of each request.
const probar = async (limite, rutas) => {
  const app = express();
  app.use('/api', crearApiRateLimit({ limit: limite, windowMs: 60_000 }));
  app.all('/api/*splat', (req, res) => res.json({ ok: true }));
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  try {
    const { port } = server.address();
    const estados = [];
    for (const ruta of rutas) {
      const res = await fetch(`http://127.0.0.1:${port}${ruta}`);
      estados.push({ status: res.status, cuerpo: await res.json() });
    }
    return estados;
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
};

test('corta con 429 y el formato { ok, error } al pasar el limite', async () => {
  const estados = await probar(2, ['/api/turnos', '/api/turnos', '/api/turnos']);
  assert.deepEqual(estados.map((e) => e.status), [200, 200, 429]);
  assert.equal(estados[2].cuerpo.ok, false);
  assert.match(estados[2].cuerpo.error, /Demasiados pedidos/);
});

test('el bot y el webhook no consumen el cupo ni se cortan', async () => {
  const rutas = ['/api/bot/x', '/api/bot/x', '/api/mercadopago/webhook', '/api/mercadopago/webhook', '/api/turnos'];
  const estados = await probar(1, rutas);
  assert.deepEqual(estados.map((e) => e.status), [200, 200, 200, 200, 200]);
});
