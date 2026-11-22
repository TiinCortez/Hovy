import test from 'node:test';
import assert from 'node:assert/strict';
import { validarDatosInmueble } from '../utils/inmuebles.js';

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
