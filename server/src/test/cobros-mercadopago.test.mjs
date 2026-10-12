import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { verificarFirmaWebhook } from '../integrations/mercadopago/cobros/webhookSignature.js';
import {
  mapearEstadoPago,
  montoCoincide,
  resolverTransicion,
  validarMonto,
} from '../integrations/mercadopago/cobros/estadoPago.js';

const SECRET = 'test-secret-not-real';
const NOW = 1_760_000_000_000;

const firmar = ({ dataId, requestId, ts, secret = SECRET }) =>
  crypto.createHmac('sha256', secret).update(`id:${dataId};request-id:${requestId};ts:${ts};`).digest('hex');

const base = (overrides = {}) => {
  const ts = String(NOW - 1000);
  const v1 = firmar({ dataId: '123456', requestId: 'req-1', ts });
  return {
    xSignature: `ts=${ts},v1=${v1}`,
    xRequestId: 'req-1',
    dataId: '123456',
    secret: SECRET,
    now: NOW,
    ...overrides,
  };
};

test('signature: valid signature is accepted', () => {
  assert.equal(verificarFirmaWebhook(base()).valida, true);
});

test('signature: tampered data id is rejected', () => {
  assert.equal(verificarFirmaWebhook(base({ dataId: '999' })).valida, false);
});

test('signature: tampered v1 is rejected', () => {
  const ts = String(NOW - 1000);
  const r = verificarFirmaWebhook(base({ xSignature: `ts=${ts},v1=${'0'.repeat(64)}` }));
  assert.equal(r.valida, false);
});

test('signature: wrong secret is rejected', () => {
  assert.equal(verificarFirmaWebhook(base({ secret: 'other-secret' })).valida, false);
});

test('signature: missing header or request id is rejected', () => {
  assert.equal(verificarFirmaWebhook(base({ xSignature: undefined })).valida, false);
  assert.equal(verificarFirmaWebhook(base({ xSignature: '' })).valida, false);
  assert.equal(verificarFirmaWebhook(base({ xRequestId: '' })).valida, false);
  assert.equal(verificarFirmaWebhook(base({ dataId: undefined })).valida, false);
});

test('signature: malformed header or ts is rejected', () => {
  assert.equal(verificarFirmaWebhook(base({ xSignature: 'garbage' })).valida, false);
  assert.equal(verificarFirmaWebhook(base({ xSignature: 'ts=abc,v1=ff' })).valida, false);
});

test('signature: stale ts is rejected even with a correct hmac', () => {
  const ts = String(NOW - 60 * 60 * 1000);
  const v1 = firmar({ dataId: '123456', requestId: 'req-1', ts });
  const r = verificarFirmaWebhook(base({ xSignature: `ts=${ts},v1=${v1}` }));
  assert.equal(r.valida, false);
});

test('signature: missing secret never validates', () => {
  assert.equal(verificarFirmaWebhook(base({ secret: '' })).valida, false);
});

test('status mapping: provider statuses map to cobro states', () => {
  assert.equal(mapearEstadoPago('approved'), 'Aprobado');
  assert.equal(mapearEstadoPago('rejected'), 'Rechazado');
  assert.equal(mapearEstadoPago('cancelled'), 'Cancelado');
  assert.equal(mapearEstadoPago('expired'), 'Expirado');
  for (const s of ['pending', 'in_process', 'authorized', 'weird', undefined]) {
    assert.equal(mapearEstadoPago(s), null);
  }
});

test('amount check: must match amount and ARS currency', () => {
  const cobro = { monto: '1500.50' };
  assert.equal(montoCoincide(cobro, { transaction_amount: 1500.5, currency_id: 'ARS' }), true);
  assert.equal(montoCoincide(cobro, { transaction_amount: 1500, currency_id: 'ARS' }), false);
  assert.equal(montoCoincide(cobro, { transaction_amount: 1500.5, currency_id: 'USD' }), false);
  assert.equal(montoCoincide(cobro, { transaction_amount: 'x', currency_id: 'ARS' }), false);
});

test('transition: approved with wrong amount is not applied', () => {
  const r = resolverTransicion({ estado: 'Pendiente', monto: 100 }, { status: 'approved', transaction_amount: 50, currency_id: 'ARS' });
  assert.equal(r.nuevoEstado, null);
});

test('transition: approved with matching amount moves Pendiente to Aprobado', () => {
  const r = resolverTransicion({ estado: 'Pendiente', monto: 100 }, { status: 'approved', transaction_amount: 100, currency_id: 'ARS' });
  assert.equal(r.nuevoEstado, 'Aprobado');
});

test('transition: Aprobado is never downgraded', () => {
  const r = resolverTransicion({ estado: 'Aprobado', monto: 100 }, { status: 'rejected', transaction_amount: 100, currency_id: 'ARS' });
  assert.equal(r.nuevoEstado, null);
});

test('transition: pending payment leaves the cobro untouched', () => {
  const r = resolverTransicion({ estado: 'Pendiente', monto: 100 }, { status: 'in_process', transaction_amount: 100, currency_id: 'ARS' });
  assert.equal(r.nuevoEstado, null);
});

test('amount validation: positive, max 2 decimals', () => {
  assert.equal(validarMonto(10), 10);
  assert.equal(validarMonto(10.55), 10.55);
  assert.equal(validarMonto(0), null);
  assert.equal(validarMonto(-5), null);
  assert.equal(validarMonto(1.234), null);
  assert.equal(validarMonto('12'), null);
  assert.equal(validarMonto(NaN), null);
});
