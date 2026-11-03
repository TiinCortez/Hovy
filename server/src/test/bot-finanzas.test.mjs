import test from 'node:test';
import assert from 'node:assert/strict';

// Cliente aislado: nunca usa las credenciales ni la base real del proyecto.
process.env.SUPABASE_URL = 'https://bot-finanzas-tests.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'bot-finanzas-tests-sin-conexion';

const {
  formatearEtiquetaMes,
  calcularRangoMes,
  armarMensajeFinanzas,
  armarMensajeDeudores,
  obtenerResumenFinanciero,
  obtenerDeudores,
} = await import('../services/finanzasStaffService.js');

const {
  resumenFinancieroStaff,
  deudoresStaff,
} = await import('../controllers/botStaffController.js');

const { default: botRoutes } = await import('../routes/bot.routes.js');

const respuesta = () => {
  const res = { statusCode: null, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
};

// ---- Helpers puros ----------------------------------------------------------

test('formatearEtiquetaMes: convierte YYYY-MM a NombreMes YYYY', () => {
  assert.equal(formatearEtiquetaMes('2026-11'), 'Noviembre 2026');
  assert.equal(formatearEtiquetaMes('2026-01'), 'Enero 2026');
  assert.equal(formatearEtiquetaMes('2026-12'), 'Diciembre 2026');
});

test('calcularRangoMes: calcula inicio y fin exclusivo del mes', () => {
  assert.deepEqual(calcularRangoMes('2026-11'), {
    inicio: '2026-11-01',
    finExclusivo: '2026-12-01',
  });
  // Diciembre pasa al año siguiente
  assert.deepEqual(calcularRangoMes('2026-12'), {
    inicio: '2026-12-01',
    finExclusivo: '2027-01-01',
  });
});

test('armarMensajeFinanzas: genera texto claro con porcentajes y montos', () => {
  const mensaje = armarMensajeFinanzas({
    mes: '2026-11',
    recaudado: 120000,
    porCobrar: 65000,
    totalLiquidado: 185000,
    porcentaje: 65,
    turnosCobrados: 5,
    turnosPendientes: 3,
  });

  assert.match(mensaje, /Resumen Financiero - Noviembre 2026/);
  assert.match(mensaje, /185\.000/);
  assert.match(mensaje, /120\.000/);
  assert.match(mensaje, /65\.000/);
  assert.match(mensaje, /65%/);
});

test('armarMensajeDeudores: lista clientes y total adeudado', () => {
  const deudores = [
    { cliente: 'Juan Pérez', saldo: 35000, telefono: '3514330429' },
    { cliente: 'Los Robles', saldo: 20000, telefono: null },
  ];
  const mensaje = armarMensajeDeudores(deudores, 55000);

  assert.match(mensaje, /Clientes con saldo pendiente \(2\)/);
  assert.match(mensaje, /Juan Pérez/);
  assert.match(mensaje, /35\.000/);
  assert.match(mensaje, /55\.000/);
});

test('armarMensajeDeudores: sin deudores avisa que las cuentas estan al dia', () => {
  const mensaje = armarMensajeDeudores([], 0);
  assert.match(mensaje, /Cuentas al día/);
});

// ---- obtenerResumenFinanciero -----------------------------------------------

test('obtenerResumenFinanciero: rechaza formato de mes invalido con 400', async () => {
  const r1 = await obtenerResumenFinanciero({ mes: 'abc' });
  assert.equal(r1.error.status, 400);

  const r2 = await obtenerResumenFinanciero({ mes: '2026-13' });
  assert.equal(r2.error.status, 400);
});

test('obtenerResumenFinanciero: calcula recaudado y por cobrar desde turnos realizados', async () => {
  const clienteMock = {
    from: (tabla) => {
      assert.equal(tabla, 'turnos');
      return {
        select() { return this; },
        eq() { return this; },
        gte() { return this; },
        lt: async () => ({
          data: [
            { id_turno: 1, cobrado: true, presupuesto: { monto_total: 50000 } },
            { id_turno: 2, cobrado: true, presupuesto: { monto_total: 30000 } },
            { id_turno: 3, cobrado: false, presupuesto: { monto_total: 20000 } },
          ],
          error: null,
        }),
      };
    },
  };

  const res = await obtenerResumenFinanciero({ mes: '2026-11', clienteSupabase: clienteMock });
  assert.equal(res.error, undefined);
  assert.equal(res.data.totalLiquidado, 100000);
  assert.equal(res.data.recaudado, 80000);
  assert.equal(res.data.porCobrar, 20000);
  assert.equal(res.data.porcentaje, 80);
  assert.equal(res.data.turnosCobrados, 2);
  assert.equal(res.data.turnosPendientes, 1);
  assert.ok(res.mensaje.includes('Noviembre 2026'));
});

// ---- obtenerDeudores --------------------------------------------------------

test('obtenerDeudores: consulta v_deudores y calcula deuda total', async () => {
  const clienteMock = {
    from: (tabla) => {
      assert.equal(tabla, 'v_deudores');
      return {
        select() { return this; },
        order() { return this; },
        limit: async () => ({
          data: [
            { id_cliente: 1, cliente: 'Ana Gómez', telefono: '351111', tipo_cliente: 'Casual', saldo: 15000 },
            { id_cliente: 2, cliente: 'Carlos Ruiz', telefono: '351222', tipo_cliente: 'Fijo', saldo: 25000 },
          ],
          error: null,
        }),
      };
    },
  };

  const res = await obtenerDeudores({ limite: 10, clienteSupabase: clienteMock });
  assert.equal(res.error, undefined);
  assert.equal(res.data.totalDeudores, 2);
  assert.equal(res.data.totalDeuda, 40000);
  assert.equal(res.data.deudores[0].saldo, 15000);
  assert.ok(res.mensaje.includes('Ana Gómez'));
  assert.ok(res.mensaje.includes('40.000'));
});

// ---- Controllers y Rutas ----------------------------------------------------

test('resumenFinancieroStaff: responde 200 con data y mensaje', async (t) => {
  const { supabaseAdmin } = await import('../config/supabase.js');
  t.mock.method(supabaseAdmin, 'from', () => ({
    select() { return this; },
    eq() { return this; },
    gte() { return this; },
    lt: async () => ({
      data: [{ id_turno: 1, cobrado: true, presupuesto: { monto_total: 10000 } }],
      error: null,
    }),
  }));

  const res = respuesta();
  await resumenFinancieroStaff(
    {
      query: { mes: '2026-11' },
      usuario: { id: 1 },
    },
    res
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.data.recaudado, 10000);
  assert.ok(res.body.mensaje.includes('Noviembre 2026'));
});

test('deudoresStaff: responde 200 con listado de deudores y mensaje', async (t) => {
  const { supabaseAdmin } = await import('../config/supabase.js');
  t.mock.method(supabaseAdmin, 'from', () => ({
    select() { return this; },
    order() { return this; },
    limit: async () => ({
      data: [{ id_cliente: 1, cliente: 'Juan Pérez', saldo: 15000, telefono: '3514330429' }],
      error: null,
    }),
  }));

  const res = respuesta();
  await deudoresStaff(
    {
      query: { limite: '10' },
      usuario: { id: 1 },
    },
    res
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.data.totalDeudores, 1);
  assert.equal(res.body.data.totalDeuda, 15000);
  assert.ok(res.body.mensaje.includes('Juan Pérez'));
});

test('bot.routes.js: expone las rutas /finanzas/resumen y /finanzas/deudores', () => {
  const rutas = botRoutes.stack
    .filter((layer) => layer.route)
    .map((layer) => ({
      path: layer.route.path,
      methods: Object.keys(layer.route.methods),
    }));

  const rutaResumen = rutas.find(
    (r) => r.path === '/staff/:telefono/finanzas/resumen' && r.methods.includes('get')
  );
  assert.ok(rutaResumen, 'GET /staff/:telefono/finanzas/resumen tiene que estar registrada.');

  const rutaDeudores = rutas.find(
    (r) => r.path === '/staff/:telefono/finanzas/deudores' && r.methods.includes('get')
  );
  assert.ok(rutaDeudores, 'GET /staff/:telefono/finanzas/deudores tiene que estar registrada.');
});
