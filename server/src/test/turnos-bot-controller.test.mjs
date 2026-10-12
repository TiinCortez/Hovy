import test from 'node:test';
import assert from 'node:assert/strict';

// Cliente aislado: nunca usa las credenciales ni la base real del proyecto.
process.env.SUPABASE_URL = 'https://turnos-bot-tests.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'turnos-bot-tests-sin-conexion';
const { supabaseAdmin } = await import('../config/supabase.js');
const { iniciarTurnoStaff, finalizarTurnoStaff } = await import('../controllers/botStaffController.js');

const turno = (estado) => ({
  id_turno: 7,
  fecha_programada: '2026-10-12',
  inicio_desde: '10:00:00',
  hasta: '12:00:00',
  estado,
  inmueble: {
    direccion: 'Av. Colón 1234',
    barrio: 'Centro',
    latitud: -31.4201,
    longitud: -64.1888,
    cliente: { nombre: 'Ana', apellido: 'Pérez' },
  },
});

function preparar(t, registro) {
  const llamadas = { updates: [] };
  t.mock.method(globalThis, 'fetch', () => { throw new Error('La prueba no permite conexiones de red.'); });
  t.mock.method(supabaseAdmin, 'from', (tabla) => {
    assert.equal(tabla, 'turnos');
    let modo = 'select';
    let payload;
    const query = {
      select() { return this; },
      update(p) { modo = 'update'; payload = p; llamadas.updates.push(p); return this; },
      eq() { return this; },
      maybeSingle: async () => ({ data: registro, error: null }),
      single: async () => ({ data: { ...registro, ...(modo === 'update' ? payload : {}) }, error: null }),
    };
    return query;
  });
  return llamadas;
}

function respuesta() {
  const res = { statusCode: null, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}

test('iniciar sin confirmado NO modifica y devuelve los datos para confirmar', async (t) => {
  const llamadas = preparar(t, turno('Coordinado'));
  const res = respuesta();
  await iniciarTurnoStaff({ params: { id: '7' }, body: {} }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.requiere_confirmacion, true);
  assert.equal(llamadas.updates.length, 0);
  assert.equal(res.body.data.direccion, 'Av. Colón 1234');
  assert.equal(res.body.data.cliente, 'Ana Pérez');
  assert.match(res.body.data.link_maps, /google\.com\/maps\/dir/);
});

test('iniciar con confirmado string "true" tampoco modifica (solo boolean true)', async (t) => {
  const llamadas = preparar(t, turno('Coordinado'));
  const res = respuesta();
  await iniciarTurnoStaff({ params: { id: '7' }, body: { confirmado: 'true' } }, res);

  assert.equal(res.body.requiere_confirmacion, true);
  assert.equal(llamadas.updates.length, 0);
});

test('iniciar con confirmado true pasa a En ejecución', async (t) => {
  const llamadas = preparar(t, turno('Confirmado'));
  const res = respuesta();
  await iniciarTurnoStaff({ params: { id: '7' }, body: { confirmado: true } }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(llamadas.updates, [{ estado: 'En ejecución' }]);
  assert.equal(res.body.data.estado, 'En ejecución');
});

test('finalizar con confirmado true pasa a Realizado', async (t) => {
  const llamadas = preparar(t, turno('En ejecución'));
  const res = respuesta();
  await finalizarTurnoStaff({ params: { id: '7' }, body: { confirmado: true } }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(llamadas.updates, [{ estado: 'Realizado' }]);
});

test('finalizar un turno que no está en ejecución devuelve 409 sin modificar', async (t) => {
  const llamadas = preparar(t, turno('Coordinado'));
  const res = respuesta();
  await finalizarTurnoStaff({ params: { id: '7' }, body: { confirmado: true } }, res);

  assert.equal(res.statusCode, 409);
  assert.equal(llamadas.updates.length, 0);
});

test('turno inexistente devuelve 404', async (t) => {
  preparar(t, null);
  const res = respuesta();
  await iniciarTurnoStaff({ params: { id: '99' }, body: { confirmado: true } }, res);
  assert.equal(res.statusCode, 404);
});

test('id inválido devuelve 400', async (t) => {
  preparar(t, turno('Coordinado'));
  const res = respuesta();
  await iniciarTurnoStaff({ params: { id: 'abc' }, body: {} }, res);
  assert.equal(res.statusCode, 400);
});

const { qrTurnoStaff } = await import('../controllers/botStaffController.js');

function respuestaBinaria() {
  const res = { statusCode: null, body: null, headers: {} };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  res.set = (h) => { Object.assign(res.headers, h); return res; };
  res.send = (b) => { res.body = b; return res; };
  return res;
}

test('qr de un turno Realizado devuelve un PNG', async (t) => {
  preparar(t, turno('Realizado'));
  const res = respuestaBinaria();
  await qrTurnoStaff({ params: { id: '7' } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.headers['Content-Type'], 'image/png');
  assert.ok(Buffer.isBuffer(res.body));
  assert.deepEqual([...res.body.subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47]);
});

test('qr de un turno que no está Realizado devuelve 409', async (t) => {
  preparar(t, turno('En ejecución'));
  const res = respuestaBinaria();
  await qrTurnoStaff({ params: { id: '7' } }, res);
  assert.equal(res.statusCode, 409);
});

test('qr de un turno inexistente devuelve 404 y con id inválido 400', async (t) => {
  preparar(t, null);
  const r404 = respuestaBinaria();
  await qrTurnoStaff({ params: { id: '99' } }, r404);
  assert.equal(r404.statusCode, 404);

  const r400 = respuestaBinaria();
  await qrTurnoStaff({ params: { id: 'x' } }, r400);
  assert.equal(r400.statusCode, 400);
});
