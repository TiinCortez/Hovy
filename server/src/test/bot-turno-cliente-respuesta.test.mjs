import test from 'node:test';
import assert from 'node:assert/strict';

// Cliente aislado: nunca usa las credenciales ni la base real del proyecto.
process.env.SUPABASE_URL = 'https://bot-turno-cliente-respuesta-tests.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'bot-turno-cliente-respuesta-tests-sin-conexion';

const { supabaseAdmin } = await import('../config/supabase.js');
const { confirmarTurnoCliente, cancelarTurnoCliente } = await import('../controllers/botTurnosClienteController.js');
const { default: botRoutes } = await import('../routes/bot.routes.js');

const respuesta = () => {
  const res = { statusCode: null, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
};

const FUTURO = '2099-12-20';
const turno = (estado = 'Coordinado') => ({
  id_turno: 12, estado, fecha_programada: FUTURO, inicio_desde: '08:00:00', hasta: '10:00:00',
  inmueble: { id_cliente: 5, direccion: 'San Lorenzo 287' },
});

// Simula supabaseAdmin.from: la lectura devuelve `lectura`; el UPDATE devuelve la fila con lo escrito.
const mockBase = (t, lectura) => {
  const consultas = [];
  t.mock.method(supabaseAdmin, 'from', (tabla) => {
    const consulta = { tabla, ops: [] };
    consultas.push(consulta);
    const builder = {};
    for (const op of ['select', 'eq', 'in', 'update']) {
      builder[op] = (...args) => { consulta.ops.push([op, ...args]); return builder; };
    }
    builder.maybeSingle = () => {
      const upd = consulta.ops.find(([o]) => o === 'update');
      return Promise.resolve(upd ? { data: { ...lectura, ...upd[1] }, error: null } : { data: lectura, error: null });
    };
    return builder;
  });
  return consultas;
};

test('confirmarTurnoCliente: usa el cliente identificado por el teléfono, nunca un id del body', async (t) => {
  const consultas = mockBase(t, turno());
  const res = respuesta();

  await confirmarTurnoCliente({ cliente: { id_cliente: 5 }, params: { id: '12' }, body: { id_cliente: 999 } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.data.estado, 'Confirmado');
  assert.match(res.body.mensaje, /Turno confirmado para el 20\/12, de 08:00 a 10:00/);
  assert.ok(consultas[0].ops.some(([o, c, v]) => o === 'eq' && c === 'inmueble.id_cliente' && v === 5));
  assert.ok(!consultas.some((c) => c.ops.some(([, , v]) => v === 999)), 'el id_cliente del body se ignora');
});

test('confirmarTurnoCliente: repetir el toque responde 200 y lo aclara', async (t) => {
  mockBase(t, turno('Confirmado'));
  const res = respuesta();
  await confirmarTurnoCliente({ cliente: { id_cliente: 5 }, params: { id: '12' } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.ya_aplicado, true);
  assert.match(res.body.mensaje, /ya estaba confirmado/);
});

test('confirmarTurnoCliente: un turno ajeno o inexistente responde 404 con el formato { ok, error }', async (t) => {
  mockBase(t, null);
  const res = respuesta();
  await confirmarTurnoCliente({ cliente: { id_cliente: 5 }, params: { id: '12' } }, res);
  assert.equal(res.statusCode, 404);
  assert.equal(res.body.ok, false);
  assert.ok(res.body.error);
});

test('cancelarTurnoCliente: marca Cancelado, aclara que no se borra y devuelve el horario liberado', async (t) => {
  const consultas = mockBase(t, turno());
  const res = respuesta();

  await cancelarTurnoCliente({ cliente: { id_cliente: 5 }, params: { id: '12' } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.estado, 'Cancelado');
  assert.match(res.body.mensaje, /Turno del 20\/12, de 08:00 a 10:00 cancelado/);
  assert.equal(consultas.some((c) => c.ops.some(([o]) => o === 'delete')), false);
});

test('cancelarTurnoCliente: un turno en curso responde 409', async (t) => {
  mockBase(t, turno('En ejecución'));
  const res = respuesta();
  await cancelarTurnoCliente({ cliente: { id_cliente: 5 }, params: { id: '12' } }, res);
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.ok, false);
});

test('bot.routes: confirmar y cancelar son POST y resuelven el cliente por teléfono antes del handler', () => {
  for (const [ruta, handler] of [
    ['/clientes/:telefono/turnos/:id/confirmar', 'confirmarTurnoCliente'],
    ['/clientes/:telefono/turnos/:id/cancelar', 'cancelarTurnoCliente'],
  ]) {
    const capa = botRoutes.stack.find((l) => l.route?.path === ruta);
    assert.ok(capa, `existe ${ruta}`);
    assert.equal(capa.route.methods.post, true);
    assert.equal(capa.route.methods.get, undefined, 'no se puede disparar con GET');
    assert.deepEqual(capa.route.stack.map((s) => s.handle.name), ['resolverClientePorTelefono', handler]);
  }
});
