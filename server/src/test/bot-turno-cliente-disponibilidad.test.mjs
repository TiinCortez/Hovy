import test from 'node:test';
import assert from 'node:assert/strict';

// Isolated client: never uses the project's real credentials or database.
process.env.SUPABASE_URL = 'https://bot-disponibilidad-cliente-tests.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'bot-disponibilidad-cliente-tests-sin-conexion';

const {
  consultarDisponibilidadCliente,
  DIAS_DISPONIBILIDAD_CLIENTE,
  LIMITE_DIAS_CLIENTE,
} = await import('../services/solicitudClienteService.js');
const { consultarDisponibilidadClienteBot } = await import('../controllers/botSolicitudesClienteController.js');
const { default: botRoutes } = await import('../routes/bot.routes.js');

const espia = (resultado = { data: [] }) => {
  const llamadas = [];
  const consultar = async (query) => { llamadas.push(query); return resultado; };
  return { llamadas, consultar };
};

test('consultarDisponibilidadCliente: con fecha pide solo los horarios de ese día', async () => {
  const { llamadas, consultar } = espia({ data: [{ fecha: '2026-11-20', disponibles: [{ inicio_desde: '09:00', hasta: '11:00' }] }] });
  const resultado = await consultarDisponibilidadCliente({ query: { fecha: '2026-11-20' }, consultar });
  assert.deepEqual(llamadas, [{ fecha: '2026-11-20' }]);
  assert.equal(resultado.data[0].disponibles[0].inicio_desde, '09:00');
});

test('consultarDisponibilidadCliente: sin fecha recorre los próximos días con un tope de días para la lista', async () => {
  const { llamadas, consultar } = espia();
  await consultarDisponibilidadCliente({ query: {}, consultar });
  assert.deepEqual(llamadas, [{ dias: DIAS_DISPONIBILIDAD_CLIENTE, limite: LIMITE_DIAS_CLIENTE }]);
  assert.ok(LIMITE_DIAS_CLIENTE <= 10, 'una lista de WhatsApp admite hasta 10 filas');
});

test('consultarDisponibilidadCliente: ignora los parámetros que el cliente no puede tocar', async () => {
  const { llamadas, consultar } = espia();
  await consultarDisponibilidadCliente({
    query: { fecha: '2026-11-20', duracion_minutos: '1', buffer_minutos: '1', desde: '00:00', hasta: '23:59', dias: '60', limite: '30' },
    consultar,
  });
  assert.deepEqual(llamadas, [{ fecha: '2026-11-20' }]);
});

// 2026-11-13 15:00 in Argentina (UTC-3).
const AHORA_TARDE = new Date('2026-11-13T18:00:00Z');

test('consultarDisponibilidadCliente: de hoy no ofrece horarios que ya empezaron', async () => {
  const { consultar } = espia({ data: [{ fecha: '2026-11-13', disponibles: [
    { inicio_desde: '08:00', hasta: '10:00' },
    { inicio_desde: '15:00', hasta: '17:00' },
    { inicio_desde: '16:00', hasta: '18:00' },
  ] }] });
  const resultado = await consultarDisponibilidadCliente({ query: { fecha: '2026-11-13' }, consultar, ahora: AHORA_TARDE });
  assert.deepEqual(resultado.data[0].disponibles.map((h) => h.inicio_desde), ['16:00']);
});

test('consultarDisponibilidadCliente: sin fecha saca el día de hoy si no le queda ningún horario', async () => {
  const { consultar } = espia({ data: [
    { fecha: '2026-11-13', disponibles: [{ inicio_desde: '08:00', hasta: '10:00' }] },
    { fecha: '2026-11-14', disponibles: [{ inicio_desde: '08:00', hasta: '10:00' }] },
  ] });
  const resultado = await consultarDisponibilidadCliente({ query: {}, consultar, ahora: AHORA_TARDE });
  assert.deepEqual(resultado.data.map((d) => d.fecha), ['2026-11-14']);
  assert.equal(resultado.data[0].disponibles.length, 1, 'los días futuros quedan enteros');
});

test('consultarDisponibilidadCliente: propaga el error del cálculo (fecha pasada)', async () => {
  const { consultar } = espia({ error: { status: 400, message: 'fecha no puede ser anterior a hoy.' } });
  const resultado = await consultarDisponibilidadCliente({ query: { fecha: '2020-01-01' }, consultar });
  assert.equal(resultado.error.status, 400);
});

const respuesta = () => {
  const res = { statusCode: null, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
};

test('consultarDisponibilidadClienteBot: responde 200 con los días y horarios libres', async () => {
  const res = respuesta();
  await consultarDisponibilidadClienteBot(
    { cliente: { id_cliente: 42 }, query: { fecha: '2026-11-20' } },
    res,
    { consultar: async () => ({ data: [{ fecha: '2026-11-20', disponibles: [] }] }) },
  );
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { ok: true, data: [{ fecha: '2026-11-20', disponibles: [] }] });
});

test('consultarDisponibilidadClienteBot: traduce el error a { ok: false, error }', async () => {
  const res = respuesta();
  await consultarDisponibilidadClienteBot(
    { cliente: { id_cliente: 42 }, query: {} },
    res,
    { consultar: async () => ({ error: { status: 400, message: 'fecha inválida' } }) },
  );
  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, { ok: false, error: 'fecha inválida' });
});

test('bot.routes: GET /clientes/:telefono/disponibilidad resuelve el cliente por teléfono antes del handler', () => {
  const capa = botRoutes.stack.find((l) => l.route?.path === '/clientes/:telefono/disponibilidad');
  assert.ok(capa, 'la ruta existe');
  assert.equal(capa.route.methods.get, true);
  assert.deepEqual(capa.route.stack.map((s) => s.handle.name), ['resolverClientePorTelefono', 'consultarDisponibilidadClienteBot']);
});
