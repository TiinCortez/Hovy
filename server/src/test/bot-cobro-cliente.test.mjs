import test from 'node:test';
import assert from 'node:assert/strict';

// Cliente aislado: nunca usa las credenciales ni la base real del proyecto.
process.env.SUPABASE_URL = 'https://bot-cobro-cliente-tests.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'bot-cobro-cliente-tests-sin-conexion';

const { supabaseAdmin } = await import('../config/supabase.js');
const { getDeudasDelCliente, crearCobroCliente, consultarCobroCliente } = await import('../controllers/botCobrosClienteController.js');
const { default: botRoutes } = await import('../routes/bot.routes.js');

const respuesta = () => {
  const res = { statusCode: null, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
};

// Simula supabaseAdmin.from por tabla y registra las consultas.
const mockBase = (t, porTabla) => {
  const consultas = [];
  t.mock.method(supabaseAdmin, 'from', (tabla) => {
    const consulta = { tabla, ops: [] };
    consultas.push(consulta);
    const builder = {};
    for (const op of ['select', 'eq', 'in', 'order', 'limit']) {
      builder[op] = (...args) => { consulta.ops.push([op, ...args]); return builder; };
    }
    const resolver = () => porTabla[tabla] ?? { data: [], error: null };
    builder.maybeSingle = () => Promise.resolve(resolver());
    builder.then = (resolve, reject) => Promise.resolve(resolver()).then(resolve, reject);
    return builder;
  });
  return consultas;
};

test('deudas: un cliente sin inmuebles no tiene deudas y se consulta solo por su id (nunca por el body)', async (t) => {
  const consultas = mockBase(t, { inmuebles: { data: [], error: null } });
  const res = respuesta();

  await getDeudasDelCliente({ cliente: { id_cliente: 5 }, query: {}, body: { id_cliente: 999 } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.deepEqual(res.body.data, []);
  assert.equal(res.body.total, 0);
  assert.match(res.body.mensaje, /No tenés deudas/);
  const inmuebles = consultas.find((c) => c.tabla === 'inmuebles');
  assert.ok(inmuebles.ops.some(([o, c, v]) => o === 'eq' && c === 'id_cliente' && v === 5));
  assert.equal(JSON.stringify(consultas).includes('999'), false);
});

test('deudas: sin cliente identificado responde 400 en el formato { ok, error }', async () => {
  const res = respuesta();
  await getDeudasDelCliente({ cliente: undefined, query: {} }, res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.ok, false);
});

test('crear cobro: un turno ajeno o inexistente responde 404 y no llega a Mercado Pago', async (t) => {
  const consultas = mockBase(t, { turnos: { data: null, error: null } });
  const res = respuesta();

  await crearCobroCliente({ cliente: { id_cliente: 5 }, params: { id: '12' }, body: { monto: 100, id_cliente: 999 } }, res);

  assert.equal(res.statusCode, 404);
  assert.equal(res.body.ok, false);
  const lectura = consultas.find((c) => c.tabla === 'turnos');
  assert.ok(lectura.ops.some(([o, c, v]) => o === 'eq' && c === 'inmueble.id_cliente' && v === 5));
  assert.equal(consultas.some((c) => c.tabla === 'mercadopago_conexion'), false, 'ni siquiera busca la cuenta de cobro');
});

test('crear cobro: un id de turno inválido responde 400', async () => {
  const res = respuesta();
  await crearCobroCliente({ cliente: { id_cliente: 5 }, params: { id: 'abc' }, body: {} }, res);
  assert.equal(res.statusCode, 400);
});

test('consultar cobro: un turno ajeno responde 404', async (t) => {
  mockBase(t, { turnos: { data: null, error: null } });
  const res = respuesta();
  await consultarCobroCliente({ cliente: { id_cliente: 5 }, params: { id: '12' } }, res);
  assert.equal(res.statusCode, 404);
  assert.equal(res.body.ok, false);
});

test('bot.routes: deudas y cobro del cliente resuelven el cliente por teléfono y usan el método correcto', () => {
  const rutas = [
    ['/clientes/:telefono/deudas', 'get', 'getDeudasDelCliente'],
    ['/clientes/:telefono/turnos/:id/cobro', 'post', 'crearCobroCliente'],
    ['/clientes/:telefono/turnos/:id/cobro', 'get', 'consultarCobroCliente'],
  ];
  for (const [ruta, metodo, handler] of rutas) {
    const capa = botRoutes.stack.find((l) => l.route?.path === ruta && l.route.methods[metodo]);
    assert.ok(capa, `existe ${metodo.toUpperCase()} ${ruta}`);
    assert.deepEqual(capa.route.stack.map((s) => s.handle.name), ['resolverClientePorTelefono', handler]);
  }
  const deudas = botRoutes.stack.find((l) => l.route?.path === '/clientes/:telefono/deudas');
  assert.equal(deudas.route.methods.post, undefined, 'las deudas son solo lectura');
});
