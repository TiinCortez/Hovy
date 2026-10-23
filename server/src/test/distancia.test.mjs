import test from 'node:test';
import assert from 'node:assert/strict';
import { distanciaLineaRecta, kmAproximados, FACTOR_RODEO } from '../utils/distancia.js';

const BUENOS_AIRES = { latitud: -34.6037, longitud: -58.3816 };
const CORDOBA = { latitud: -31.4201, longitud: -64.1888 };
const SALIDA = { latitud: -24.1858, longitud: -65.2995 };
const DESTINO = { latitud: -24.2177, longitud: -65.2781 };

const cercano = (real, esperado, tolerancia) => Math.abs(real - esperado) <= tolerancia;

test('distanciaLineaRecta: Buenos Aires a Cordoba ronda los 646 km', () => {
  const d = distanciaLineaRecta(BUENOS_AIRES, CORDOBA);
  assert.ok(cercano(d, 646, 3), `esperaba ~646 km y dio ${d}`);
});

test('distanciaLineaRecta: el ejemplo de Jujuy ronda los 4,2 km', () => {
  const d = distanciaLineaRecta(SALIDA, DESTINO);
  assert.ok(cercano(d, 4.16, 0.1), `esperaba ~4,16 km y dio ${d}`);
});

test('distanciaLineaRecta: mismo punto es 0 y es simetrica', () => {
  assert.equal(distanciaLineaRecta(SALIDA, SALIDA), 0);
  assert.equal(distanciaLineaRecta(SALIDA, DESTINO), distanciaLineaRecta(DESTINO, SALIDA));
});

test('kmAproximados: aplica el factor de rodeo y redondea a 2 decimales', () => {
  assert.equal(FACTOR_RODEO, 1.3);
  const recta = distanciaLineaRecta(SALIDA, DESTINO);
  assert.equal(kmAproximados(SALIDA, DESTINO), Math.round(recta * FACTOR_RODEO * 100) / 100);
  assert.ok(cercano(kmAproximados(SALIDA, DESTINO), 5.4, 0.15));
});

test('kmAproximados: nunca es menor que la linea recta', () => {
  assert.ok(kmAproximados(BUENOS_AIRES, CORDOBA) > distanciaLineaRecta(BUENOS_AIRES, CORDOBA));
});
