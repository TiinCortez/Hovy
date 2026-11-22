import test from 'node:test';
import assert from 'node:assert/strict';
import { validarDatosInmueble, pasaASinMedir } from '../utils/inmuebles.js';

// El cliente que registra un inmueble por WhatsApp puede no saber los m2.
// En el alta, superficie_total = 0 es un valor simbólico ("sin medir"): se mide en la visita.
const base = {
  direccion: 'San Lorenzo 287',
  provincia: 'Córdoba',
  tipo_inmueble: 'Casa Habitada',
};

test('alta: superficie_total 0 es válida (valor simbólico, se mide en la visita)', () => {
  assert.deepEqual(validarDatosInmueble({ ...base, superficie_total: 0 }, { parcial: false }), []);
  assert.deepEqual(validarDatosInmueble({ ...base, superficie_total: '0' }, { parcial: false }), []);
});

test('alta: superficie_total sigue siendo obligatoria (no puede faltar ni venir vacía)', () => {
  const faltante = validarDatosInmueble({ ...base }, { parcial: false });
  assert.equal(faltante.length, 1);
  assert.match(faltante[0], /superficie_total/);
  const vacia = validarDatosInmueble({ ...base, superficie_total: '' }, { parcial: false });
  assert.match(vacia.join(' '), /superficie_total/);
});

test('alta: superficie_total negativa o no numérica sigue rechazada', () => {
  assert.match(validarDatosInmueble({ ...base, superficie_total: -5 }, { parcial: false }).join(' '), /negativo/);
  assert.match(validarDatosInmueble({ ...base, superficie_total: 'abc' }, { parcial: false }).join(' '), /número/);
});

test('alta: una superficie real sigue siendo válida', () => {
  assert.deepEqual(validarDatosInmueble({ ...base, superficie_total: 250 }, { parcial: false }), []);
});

test('alta: la construida no puede superar a la total, tampoco con total 0', () => {
  const errores = validarDatosInmueble({ ...base, superficie_total: 0, superficie_construida: 50 }, { parcial: false });
  assert.match(errores.join(' '), /construida/);
});

test('modificación: superficie_total 0 sigue rechazada (el 0 es solo para el alta)', () => {
  const errores = validarDatosInmueble({ superficie_total: 0 }, { parcial: true });
  assert.match(errores.join(' '), /mayor a 0/);
});

test('modificación: superficie_total real sigue válida', () => {
  assert.deepEqual(validarDatosInmueble({ superficie_total: 300 }, { parcial: true }), []);
});

test('otros campos numéricos no cambian: tiempo_promedio_min en 0 sigue rechazado', () => {
  const errores = validarDatosInmueble({ ...base, superficie_total: 0, tiempo_promedio_min: 0 }, { parcial: false });
  assert.match(errores.join(' '), /tiempo_promedio_min/);
});

// Edición web: el 0 solo se permite si el inmueble ya estaba sin medir.
test('edición: pasar un inmueble ya medido a 0 es un cambio inválido', () => {
  assert.equal(pasaASinMedir(450, 0), true);
  assert.equal(pasaASinMedir('450.00', '0'), true);
});

test('edición: un inmueble ya sin medir puede seguir en 0 (no se bloquea editar otros datos)', () => {
  assert.equal(pasaASinMedir(0, 0), false);
  assert.equal(pasaASinMedir('0.00', '0'), false);
});

test('edición: cargar m² reales, o no tocar la superficie, no es pasar a sin medir', () => {
  assert.equal(pasaASinMedir(0, 300), false);
  assert.equal(pasaASinMedir(450, 500), false);
  assert.equal(pasaASinMedir(450, undefined), false);
  assert.equal(pasaASinMedir(450, ''), false);
  assert.equal(pasaASinMedir(450, null), false);
});
