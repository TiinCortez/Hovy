import test from 'node:test';
import assert from 'node:assert/strict';
import { resumenAvisoWhatsapp } from '../../../client/src/components/turnos/avisoWhatsapp.js';

// Lo que el panel le muestra al admin después de asignar un turno, según lo que respondió el backend.

test('avisó al cliente: confirmación breve que se va sola', () => {
  const r = resumenAvisoWhatsapp({ enviado: true, motivo: null });
  assert.equal(r.tipo, 'ok');
  assert.match(r.mensaje, /avisamos al cliente por WhatsApp/i);
  assert.equal(r.duracion, undefined);
});

test('fuera de las 24 h: le dice al admin que avise él, con el motivo en claro', () => {
  const r = resumenAvisoWhatsapp({ enviado: false, motivo: 'fuera_de_ventana' });
  assert.equal(r.tipo, 'aviso');
  assert.match(r.mensaje, /24 h/);
  assert.match(r.mensaje, /Avisale vos/);
  assert.ok(r.duracion >= 8000, 'queda visible el tiempo suficiente para leerlo');
});

test('sin precio o sin teléfono: explica por qué no se avisó', () => {
  assert.match(resumenAvisoWhatsapp({ enviado: false, motivo: 'sin_precio' }).mensaje, /precio final/);
  assert.match(resumenAvisoWhatsapp({ enviado: false, motivo: 'sin_telefono' }).mensaje, /tel[eé]fono/);
});

test('problemas técnicos (sin configurar, clave, conexión, timeout, errores de WhatsApp): un solo mensaje para el admin', () => {
  for (const motivo of ['no_configurado', 'sin_clave', 'no_autorizado', 'sin_conexion', 'timeout', 'error_whatsapp', 'error_webhook_502', 'error_inesperado', 'datos_invalidos']) {
    const r = resumenAvisoWhatsapp({ enviado: false, motivo });
    assert.equal(r.tipo, 'aviso', motivo);
    assert.match(r.mensaje, /No se pudo avisar al cliente por WhatsApp/, motivo);
    assert.match(r.mensaje, /Avisale vos/, motivo);
  }
});

test('turno cancelado o respuesta sin el campo (backend viejo): no muestra nada', () => {
  assert.equal(resumenAvisoWhatsapp({ enviado: false, motivo: 'turno_cancelado' }), null);
  assert.equal(resumenAvisoWhatsapp(undefined), null);
  assert.equal(resumenAvisoWhatsapp(null), null);
  assert.equal(resumenAvisoWhatsapp({}), null);
});

test('no expone códigos internos al admin', () => {
  const r = resumenAvisoWhatsapp({ enviado: false, motivo: 'error_webhook_502' });
  assert.doesNotMatch(r.mensaje, /502|webhook|n8n/i);
});
