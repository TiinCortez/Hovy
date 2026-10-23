import test from 'node:test';
import assert from 'node:assert/strict';

const { armarLinkMaps, resolverTransicionTurno } = await import('../utils/turnosBot.js');

test('armarLinkMaps usa las coordenadas cuando existen', () => {
  const link = armarLinkMaps({ latitud: -31.4201, longitud: -64.1888, direccion: 'Av. Colon 1234' });
  assert.equal(link, 'https://www.google.com/maps/dir/?api=1&destination=-31.4201%2C-64.1888&travelmode=driving');
});

test('armarLinkMaps acepta coordenadas como string', () => {
  const link = armarLinkMaps({ latitud: '-31.42', longitud: '-64.18' });
  assert.match(link, /destination=-31\.42%2C-64\.18/);
});

test('armarLinkMaps cae a direccion y barrio si no hay coordenadas', () => {
  const link = armarLinkMaps({ latitud: null, longitud: null, direccion: 'Av. Colón 1234', barrio: 'Nueva Córdoba' });
  assert.equal(
    link,
    `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent('Av. Colón 1234, Nueva Córdoba')}&travelmode=driving`,
  );
});

test('armarLinkMaps ignora coordenadas fuera de Argentina y usa la direccion', () => {
  const link = armarLinkMaps({ latitud: 0, longitud: 0, direccion: 'Calle Falsa 123' });
  assert.match(link, /destination=Calle%20Falsa%20123/);
});

test('armarLinkMaps devuelve null sin ubicacion util', () => {
  assert.equal(armarLinkMaps({}), null);
  assert.equal(armarLinkMaps(null), null);
  assert.equal(armarLinkMaps({ direccion: '   ' }), null);
});

test('iniciar solo desde Coordinado o Confirmado', () => {
  assert.deepEqual(resolverTransicionTurno('Coordinado', 'iniciar'), { ok: true, estadoNuevo: 'En ejecución' });
  assert.deepEqual(resolverTransicionTurno('Confirmado', 'iniciar'), { ok: true, estadoNuevo: 'En ejecución' });
  for (const estado of ['En ejecución', 'Realizado', 'Cancelado']) {
    assert.equal(resolverTransicionTurno(estado, 'iniciar').ok, false, estado);
  }
});

test('finalizar solo desde En ejecución', () => {
  assert.deepEqual(resolverTransicionTurno('En ejecución', 'finalizar'), { ok: true, estadoNuevo: 'Realizado' });
  for (const estado of ['Coordinado', 'Confirmado', 'Realizado', 'Cancelado']) {
    assert.equal(resolverTransicionTurno(estado, 'finalizar').ok, false, estado);
  }
});

test('resolverTransicionTurno explica por que no se puede', () => {
  const r = resolverTransicionTurno('Realizado', 'iniciar');
  assert.equal(r.ok, false);
  assert.match(r.error, /Realizado/);
});

test('resolverTransicionTurno rechaza acciones desconocidas', () => {
  assert.equal(resolverTransicionTurno('Coordinado', 'borrar').ok, false);
});

test('parsearEstadosTurno acepta una lista separada por comas', async () => {
  const { parsearEstadosTurno } = await import('../utils/turnosBot.js');
  assert.deepEqual(parsearEstadosTurno('Coordinado, Confirmado'), { ok: true, estados: ['Coordinado', 'Confirmado'] });
});

test('parsearEstadosTurno ignora mayusculas y tildes', async () => {
  const { parsearEstadosTurno } = await import('../utils/turnosBot.js');
  assert.deepEqual(parsearEstadosTurno('en ejecucion'), { ok: true, estados: ['En ejecución'] });
  assert.deepEqual(parsearEstadosTurno('REALIZADO'), { ok: true, estados: ['Realizado'] });
});

test('parsearEstadosTurno devuelve lista vacia sin valor y rechaza estados desconocidos', async () => {
  const { parsearEstadosTurno } = await import('../utils/turnosBot.js');
  assert.deepEqual(parsearEstadosTurno(undefined), { ok: true, estados: [] });
  assert.deepEqual(parsearEstadosTurno('  '), { ok: true, estados: [] });
  const malo = parsearEstadosTurno('Coordinado,volando');
  assert.equal(malo.ok, false);
  assert.match(malo.error, /volando/);
});
