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

// El QR del turno ahora es el link de pago real de Mercado Pago (crearCobroDeTurno):
// sus casos (id inválido, inexistente, no Realizado, ya cobrado, reutilización) se
// prueban en bot-qr-turno.test.mjs. Los tests de acá fijaban el QR provisorio.

const { listarTurnosStaff } = await import('../controllers/botStaffController.js');

function prepararListado(t, filas = []) {
  const filtros = [];
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-12T15:00:00Z').getTime() });
  t.mock.method(supabaseAdmin, 'from', (tabla) => {
    assert.equal(tabla, 'turnos');
    const registrar = (nombre) => function (...args) { filtros.push([nombre, ...args]); return this; };
    return {
      select() { return this; },
      order() { return this; },
      eq: registrar('eq'),
      neq: registrar('neq'),
      in: registrar('in'),
      gte: registrar('gte'),
      limit: registrar('limit'),
      then(resolver) { return resolver({ data: filas, error: null }); },
    };
  });
  return filtros;
}

test('listar sin parametros trae los de hoy en Córdoba sin cancelados', async (t) => {
  const filtros = prepararListado(t);
  const res = respuesta();
  await listarTurnosStaff({ query: {} }, res);

  assert.equal(res.statusCode, 200);
  assert.ok(filtros.some((f) => f[0] === 'eq' && f[1] === 'fecha_programada' && f[2] === '2026-10-12'));
  assert.ok(filtros.some((f) => f[0] === 'neq' && f[1] === 'estado' && f[2] === 'Cancelado'));
});

test('listar con todas=true no filtra por fecha, acepta varios estados y limita a 10', async (t) => {
  const filtros = prepararListado(t);
  const res = respuesta();
  await listarTurnosStaff({ query: { todas: 'true', estado: 'Coordinado,Confirmado', desde: '2026-10-12' } }, res);

  assert.equal(res.statusCode, 200);
  assert.ok(!filtros.some((f) => f[0] === 'eq' && f[1] === 'fecha_programada'), 'sin filtro de fecha exacta');
  assert.deepEqual(filtros.find((f) => f[0] === 'in'), ['in', 'estado', ['Coordinado', 'Confirmado']]);
  assert.deepEqual(filtros.find((f) => f[0] === 'gte'), ['gte', 'fecha_programada', '2026-10-12']);
  assert.deepEqual(filtros.find((f) => f[0] === 'limit'), ['limit', 10]);
});

test('listar con un solo estado conserva el filtro por igualdad', async (t) => {
  const filtros = prepararListado(t);
  const res = respuesta();
  await listarTurnosStaff({ query: { todas: 'true', estado: 'En ejecución' } }, res);

  assert.ok(filtros.some((f) => f[0] === 'eq' && f[1] === 'estado' && f[2] === 'En ejecución'));
});

test('listar rechaza un estado desconocido con 400', async (t) => {
  prepararListado(t);
  const res = respuesta();
  await listarTurnosStaff({ query: { estado: 'volando' } }, res);
  assert.equal(res.statusCode, 400);
});

test('listar rechaza una fecha desde invalida con 400', async (t) => {
  prepararListado(t);
  const res = respuesta();
  await listarTurnosStaff({ query: { todas: 'true', desde: 'ayer' } }, res);
  assert.equal(res.statusCode, 400);
});

test('listar con todas=true y sin estado trae solo los turnos accionables, no los Realizados ni Cancelados', async (t) => {
  const filtros = prepararListado(t);
  const res = respuesta();
  await listarTurnosStaff({ query: { todas: 'true' } }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(filtros.find((f) => f[0] === 'in'), ['in', 'estado', ['Coordinado', 'Confirmado', 'En ejecución']]);
  assert.ok(!filtros.some((f) => f[0] === 'neq'), 'no depende de excluir solo Cancelado');
  assert.deepEqual(filtros.find((f) => f[0] === 'limit'), ['limit', 10]);
});
