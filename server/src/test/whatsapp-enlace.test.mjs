import test from 'node:test';
import assert from 'node:assert/strict';
import { obtenerEnlaceWhatsApp } from '../../../client/src/services/whatsapp.js';
import { normalizarTelefono } from '../utils/telefono.js';

test('WhatsApp apunta al mismo cliente en todos los formatos de teléfono admitidos', () => {
  for (const telefono of [
    '3514330429', 3514330429, '5493514330429', '543514330429',
    '+54 9 351 433-0429', '03514330429', '00 54 9 351 4330429'
  ]) {
    assert.equal(obtenerEnlaceWhatsApp(telefono), 'https://wa.me/5493514330429');
    assert.equal(obtenerEnlaceWhatsApp(telefono), `https://wa.me/${normalizarTelefono(telefono)}`);
  }
});

test('no genera enlaces a destinatarios incompletos ni adivina los teléfonos con prefijo 15', () => {
  for (const telefono of [undefined, null, '', 'no disponible', '351433', '0351 15 4330429', {}, true]) {
    assert.equal(obtenerEnlaceWhatsApp(telefono), null);
  }
});
