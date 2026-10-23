import test from 'node:test';
import assert from 'node:assert/strict';

// Isolated client: these tests never touch the real project database.
process.env.SUPABASE_URL = 'https://logistica-endpoints-tests.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'logistica-endpoints-sin-conexion';
const { supabaseAdmin } = await import('../config/supabase.js');
const { resolverFechaConsulta } = await import('../utils/fechaArgentina.js');
const { logisticaDia, logisticaStaff } = await import('../controllers/logisticaController.js');

const res = () => ({
  codigo: 200,
  status(codigo) { this.codigo = codigo; return this; },
  json(body) { this.body = body; return this; },
});

// Stand-in for the turnos query chain of the day.
const simularTurnos = (t, { data = [], error = null } = {}) => {
  const consultas = [];
  t.mock.method(supabaseAdmin, 'from', (tabla) => {
    const consulta = { tabla, filtros: [] };
    consultas.push(consulta);
    const query = {
      select() { return this; },
      eq(...args) { consulta.filtros.push(['eq', ...args]); return this; },
      neq(...args) { consulta.filtros.push(['neq', ...args]); return this; },
      order() { return this; },
      then(resolve, reject) { return Promise.resolve({ data, error }).then(resolve, reject); },
    };
    return query;
  });
  return consultas;
};

// ---- resolverFechaConsulta --------------------------------------------------

test('resolverFechaConsulta: sin fecha usa hoy en hora argentina', () => {
  // 02:00 UTC del 23/10 todavia es 22/10 en Argentina (UTC-3)
  const r = resolverFechaConsulta(undefined, new Date('2026-10-23T02:00:00Z'));
  assert.equal(r.fecha, '2026-10-22');
  assert.equal(resolverFechaConsulta('', new Date('2026-10-23T02:00:00Z')).fecha, '2026-10-22');
});

test('resolverFechaConsulta: acepta una fecha valida, incluso pasada', () => {
  assert.equal(resolverFechaConsulta(' 2026-01-05 ').fecha, '2026-01-05');
});

test('resolverFechaConsulta: rechaza formato invalido y fechas inexistentes', () => {
  for (const valor of ['23/10/2026', '2026-1-5', 'hoy', '2026-02-30', '2026-13-01']) {
    assert.ok(resolverFechaConsulta(valor).error, `${valor} debe rechazarse`);
  }
});

// ---- web: GET /api/logistica/dia -------------------------------------------

test('web: una fecha invalida es un 400 y no consulta la base', async (t) => {
  const consultas = simularTurnos(t);
  const r = res();
  await logisticaDia({ query: { fecha: 'mañana' }, user: { sub: 1 } }, r);
  assert.equal(r.codigo, 400);
  assert.equal(consultas.length, 0);
});

test('web: sin usuario identificable es un 401', async (t) => {
  simularTurnos(t);
  const r = res();
  await logisticaDia({ query: {}, user: {} }, r);
  assert.equal(r.codigo, 401);
});

test('web: un dia sin turnos responde ok con ceros, filtrando por fecha y sin cancelados', async (t) => {
  const consultas = simularTurnos(t, { data: [] });
  const r = res();
  await logisticaDia({ query: { fecha: '2026-10-23' }, user: { sub: 1 } }, r);
  assert.equal(r.codigo, 200);
  assert.equal(r.body.ok, true);
  assert.equal(r.body.data.turnos, 0);
  assert.equal(r.body.data.ruta.motivo, 'sin_turnos');
  assert.equal('mensaje' in r.body, false);
  const turnos = consultas.find((c) => c.tabla === 'turnos');
  assert.ok(turnos.filtros.some((f) => f[0] === 'eq' && f[1] === 'fecha_programada' && f[2] === '2026-10-23'));
  assert.ok(turnos.filtros.some((f) => f[0] === 'neq' && f[1] === 'estado' && f[2] === 'Cancelado'));
});

test('web: un error de base es un 500 sin filtrar el detalle', async (t) => {
  simularTurnos(t, { error: { message: 'detalle interno xyz' } });
  const r = res();
  await logisticaDia({ query: { fecha: '2026-10-23' }, user: { sub: 1 } }, r);
  assert.equal(r.codigo, 500);
  assert.equal(JSON.stringify(r.body).includes('xyz'), false);
});

// ---- bot: GET /api/bot/staff/:telefono/logistica ---------------------------

test('bot: usa el usuario resuelto por telefono y agrega un mensaje listo para WhatsApp', async (t) => {
  simularTurnos(t, { data: [] });
  const r = res();
  await logisticaStaff({ query: { fecha: '2026-10-23' }, usuario: { id: 4, rol: 'admin' } }, r);
  assert.equal(r.codigo, 200);
  assert.equal(r.body.ok, true);
  assert.equal(r.body.data.turnos, 0);
  assert.match(r.body.mensaje, /No hay turnos/);
});

test('bot: una fecha invalida es un 400', async (t) => {
  simularTurnos(t);
  const r = res();
  await logisticaStaff({ query: { fecha: '2026-02-30' }, usuario: { id: 4 } }, r);
  assert.equal(r.codigo, 400);
});
