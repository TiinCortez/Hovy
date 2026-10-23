import test from 'node:test';
import assert from 'node:assert/strict';
import { debeRegistrarRequest } from '../middleware/requestTracer.js';

const pedido = (extra = {}) => ({ method: 'GET', path: '/api/visitas', statusCode: 200, ...extra });
const DESARROLLO = { production: false, logAll: false };
const PRODUCCION = { production: true, logAll: false };

test('los errores siempre se registran, en cualquier entorno', () => {
  for (const entorno of [DESARROLLO, PRODUCCION]) {
    assert.equal(debeRegistrarRequest(pedido({ statusCode: 400 }), entorno), true);
    assert.equal(debeRegistrarRequest(pedido({ statusCode: 404 }), entorno), true);
    assert.equal(debeRegistrarRequest(pedido({ statusCode: 500 }), entorno), true);
    assert.equal(debeRegistrarRequest(pedido({ method: 'OPTIONS', statusCode: 403 }), entorno), true);
  }
});

test('en desarrollo no se registran los pedidos exitosos', () => {
  assert.equal(debeRegistrarRequest(pedido({ statusCode: 200 }), DESARROLLO), false);
  assert.equal(debeRegistrarRequest(pedido({ statusCode: 304 }), DESARROLLO), false);
  assert.equal(debeRegistrarRequest(pedido({ method: 'POST', statusCode: 201 }), DESARROLLO), false);
});

test('en produccion se siguen registrando los pedidos exitosos', () => {
  assert.equal(debeRegistrarRequest(pedido({ statusCode: 200 }), PRODUCCION), true);
  assert.equal(debeRegistrarRequest(pedido({ statusCode: 304 }), PRODUCCION), true);
});

test('el preflight de CORS exitoso nunca se registra', () => {
  const preflight = pedido({ method: 'OPTIONS', statusCode: 204 });
  assert.equal(debeRegistrarRequest(preflight, DESARROLLO), false);
  assert.equal(debeRegistrarRequest(preflight, PRODUCCION), false);
});

test('el healthcheck exitoso no se registra, pero si falla si', () => {
  assert.equal(debeRegistrarRequest(pedido({ path: '/api/health', statusCode: 200 }), PRODUCCION), false);
  assert.equal(debeRegistrarRequest(pedido({ path: '/api/health', statusCode: 503 }), PRODUCCION), true);
});

test('LOG_HTTP=all registra todo, salvo el healthcheck', () => {
  const todo = { production: false, logAll: true };
  assert.equal(debeRegistrarRequest(pedido({ statusCode: 304 }), todo), true);
  assert.equal(debeRegistrarRequest(pedido({ method: 'OPTIONS', statusCode: 204 }), todo), true);
  assert.equal(debeRegistrarRequest(pedido({ path: '/api/health', statusCode: 200 }), todo), false);
});
