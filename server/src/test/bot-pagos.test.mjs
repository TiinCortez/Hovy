import test from 'node:test';
import assert from 'node:assert/strict';

// Cliente aislado: nunca usa las credenciales ni la base real del proyecto.
process.env.SUPABASE_URL = 'https://bot-pagos-tests.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'bot-pagos-tests-sin-conexion';

const { supabaseAdmin } = await import('../config/supabase.js');
const { saldoTurnoStaff, registrarPagoTurnoStaff } = await import('../controllers/botStaffController.js');
const { default: botRoutes } = await import('../routes/bot.routes.js');

const respuesta = () => {
  const res = { statusCode: null, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
};

// ---- saldoTurnoStaff --------------------------------------------------------

test('saldoTurnoStaff: un id invalido es un 400', async () => {
  const res = respuesta();
  await saldoTurnoStaff({ params: { id: 'abc' }, usuario: { id: 1 } }, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.ok, false);
  assert.match(res.body.error, /id del turno/i);
});

test('saldoTurnoStaff: un turno inexistente devuelve 404', async (t) => {
  t.mock.method(supabaseAdmin, 'from', (tabla) => {
    return {
      select() { return this; },
      eq() { return this; },
      order() { return this; },
      limit() { return this; },
      maybeSingle: async () => ({ data: null, error: null }),
      then(resolve) { resolve({ data: [], error: null }); },
    };
  });

  const res = respuesta();
  await saldoTurnoStaff({ params: { id: '999' }, usuario: { id: 1 } }, res);

  assert.equal(res.statusCode, 404);
  assert.equal(res.body.ok, false);
  assert.match(res.body.error, /no existe/i);
});

test('saldoTurnoStaff: devuelve el saldo y los pagos con status 200', async (t) => {
  t.mock.method(supabaseAdmin, 'from', (tabla) => {
    if (tabla === 'turnos') {
      return {
        select() { return this; },
        eq() { return this; },
        maybeSingle: async () => ({
          data: {
            id_turno: 5,
            estado: 'Realizado',
            cobrado: false,
            id_inmueble: 1,
            id_presupuesto: 10,
          },
          error: null,
        }),
      };
    }
    if (tabla === 'trabajos_ejecutados') {
      return {
        select() { return this; },
        eq() { return this; },
        maybeSingle: async () => ({ data: { id_trabajo: 20 }, error: null }),
      };
    }
    if (tabla === 'movimientos_cuenta') {
      return {
        select() { return this; },
        eq() { return this; },
        order() { return this; },
        then(resolve) {
          resolve({
            data: [{ id_movimiento: 1, tipo: 'Debito', monto: 15000 }],
            error: null,
          });
        },
      };
    }
    if (tabla === 'presupuestos') {
      return {
        select() { return this; },
        eq() { return this; },
        maybeSingle: async () => ({ data: { total: 15000 }, error: null }),
      };
    }
    if (tabla === 'pagos') {
      return {
        select() { return this; },
        eq() { return this; },
        order() { return this; },
        then(resolve) {
          resolve({ data: [], error: null });
        },
      };
    }
    return {
      select() { return this; },
      eq() { return this; },
      order() { return this; },
      limit() { return this; },
      maybeSingle: async () => ({ data: null, error: null }),
      then(resolve) { resolve({ data: [], error: null }); },
    };
  });

  const res = respuesta();
  await saldoTurnoStaff({ params: { id: '5' }, usuario: { id: 1 } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.data.id_turno, 5);
  assert.equal(res.body.data.pendiente, 15000);
  assert.equal(res.body.data.cobrado, false);
});

// ---- registrarPagoTurnoStaff ------------------------------------------------

test('registrarPagoTurnoStaff: sin usuario de staff identificable devuelve 401', async () => {
  const res = respuesta();
  await registrarPagoTurnoStaff({ params: { id: '5' }, body: { medio: 'Efectivo', monto: 5000 } }, res);

  assert.equal(res.statusCode, 401);
  assert.equal(res.body.ok, false);
  assert.match(res.body.error, /identificar al usuario/i);
});

test('registrarPagoTurnoStaff: parametros o cuerpo invalidos devuelven 400', async () => {
  const res = respuesta();
  await registrarPagoTurnoStaff(
    { params: { id: '5' }, body: { medio: 'Cheque', monto: 5000 }, usuario: { id: 2 } },
    res
  );

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.ok, false);
  assert.match(res.body.error, /medio/i);
});

test('registrarPagoTurnoStaff: una regla de negocio (P0001) devuelve 409 con el mensaje de la base', async (t) => {
  t.mock.method(supabaseAdmin, 'rpc', async () => ({
    data: null,
    error: { code: 'P0001', message: 'El turno tiene que estar Realizado para registrar un pago.' },
  }));

  const res = respuesta();
  await registrarPagoTurnoStaff(
    { params: { id: '5' }, body: { medio: 'Efectivo', monto: 5000 }, usuario: { id: 2 } },
    res
  );

  assert.equal(res.statusCode, 409);
  assert.equal(res.body.ok, false);
  assert.equal(res.body.error, 'El turno tiene que estar Realizado para registrar un pago.');
});

test('registrarPagoTurnoStaff: registra un pago en efectivo con exito y devuelve 201', async (t) => {
  let llamadaRpc = null;
  t.mock.method(supabaseAdmin, 'rpc', async (fnName, params) => {
    llamadaRpc = { fnName, params };
    return {
      data: {
        registrado: true,
        id_pago: 101,
        id_movimiento: 202,
        pendiente: 0,
        cobrado: true,
        cobros_cancelados: 1,
      },
      error: null,
    };
  });

  const res = respuesta();
  await registrarPagoTurnoStaff(
    { params: { id: '5' }, body: { medio: 'Efectivo', monto: 15000 }, usuario: { id: 2 } },
    res
  );

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.ok, true);
  assert.equal(llamadaRpc.fnName, 'fn_registrar_pago_turno');
  assert.deepEqual(llamadaRpc.params, {
    p_id_turno: 5,
    p_monto: 15000,
    p_medio: 'Efectivo',
    p_referencia: null,
    p_id_usuario: 2,
  });
  assert.equal(res.body.data.id_pago, 101);
  assert.equal(res.body.data.medio, 'Efectivo');
  assert.equal(res.body.data.cobrado, true);
});

test('registrarPagoTurnoStaff: registra una transferencia con referencia y devuelve 201', async (t) => {
  let llamadaRpc = null;
  t.mock.method(supabaseAdmin, 'rpc', async (fnName, params) => {
    llamadaRpc = { fnName, params };
    return {
      data: {
        registrado: true,
        id_pago: 102,
        id_movimiento: 203,
        pendiente: 5000,
        cobrado: false,
        cobros_cancelados: 1,
      },
      error: null,
    };
  });

  const res = respuesta();
  await registrarPagoTurnoStaff(
    {
      params: { id: '5' },
      body: { medio: 'transferencia', monto: 10000, referencia: 'TRF-123456' },
      usuario: { id: 3 },
    },
    res
  );

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.ok, true);
  assert.deepEqual(llamadaRpc.params, {
    p_id_turno: 5,
    p_monto: 10000,
    p_medio: 'Transferencia',
    p_referencia: 'TRF-123456',
    p_id_usuario: 3,
  });
  assert.equal(res.body.data.medio, 'Transferencia');
  assert.equal(res.body.data.pendiente, 5000);
});


// ---- bot.routes.js registration ---------------------------------------------

test('bot.routes.js: expone las rutas de saldo y pagos bajo /staff/:telefono/turnos/:id', () => {
  const rutas = botRoutes.stack
    .filter((layer) => layer.route)
    .map((layer) => ({
      path: layer.route.path,
      methods: Object.keys(layer.route.methods),
    }));

  const rutaSaldo = rutas.find(
    (r) => r.path === '/staff/:telefono/turnos/:id/saldo' && r.methods.includes('get')
  );
  assert.ok(rutaSaldo, 'La ruta GET /staff/:telefono/turnos/:id/saldo tiene que estar registrada.');

  const rutaPagos = rutas.find(
    (r) => r.path === '/staff/:telefono/turnos/:id/pagos' && r.methods.includes('post')
  );
  assert.ok(rutaPagos, 'La ruta POST /staff/:telefono/turnos/:id/pagos tiene que estar registrada.');
});
