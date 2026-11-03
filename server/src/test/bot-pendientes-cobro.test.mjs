import test from 'node:test';
import assert from 'node:assert/strict';

process.env.SUPABASE_URL = 'https://bot-pendientes-cobro-tests.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'bot-pendientes-cobro-tests-sin-conexion';

const {
  armarMensajePendientesCobro,
  obtenerTurnosPendientesCobro,
} = await import('../services/turnosPendientesCobroService.js');

const {
  turnosPendientesCobroStaff,
} = await import('../controllers/botStaffController.js');

const { default: botRoutes } = await import('../routes/bot.routes.js');

const respuesta = () => {
  const res = { statusCode: null, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
};

// ---- Helpers puros ----------------------------------------------------------

test('armarMensajePendientesCobro: sin turnos avisa que no hay pendientes', () => {
  assert.equal(
    armarMensajePendientesCobro([]),
    'No hay turnos realizados con saldo pendiente de cobro.'
  );
  assert.equal(
    armarMensajePendientesCobro(null),
    'No hay turnos realizados con saldo pendiente de cobro.'
  );
});

test('armarMensajePendientesCobro: con turnos formatea la lista numerada con saldos', () => {
  const turnos = [
    {
      cliente: 'Jimena Vedelago',
      direccion: 'Obispo Oro 433',
      barrio: 'Nueva Córdoba',
      fecha: '2026-10-13',
      saldo_pendiente: 60000,
    },
    {
      cliente: 'Agustín Manolo',
      direccion: 'José de la iglesia 1356',
      barrio: null,
      fecha: '2026-11-03',
      saldo_pendiente: 15000.5,
    },
  ];

  const mensaje = armarMensajePendientesCobro(turnos);
  assert.ok(mensaje.includes('Hay 2 turnos pendientes de cobro:'));
  assert.ok(mensaje.includes('1. *Jimena Vedelago* - Obispo Oro 433, Nueva Córdoba (13/10) - *Saldo: $60.000,00*'));
  assert.ok(mensaje.includes('2. *Agustín Manolo* - José de la iglesia 1356 (03/11) - *Saldo: $15.000,50*'));
});

// ---- obtenerTurnosPendientesCobro -------------------------------------------

test('obtenerTurnosPendientesCobro: lista turnos realizados con saldo pendiente > 0', async () => {
  const mockCliente = {
    from: (tabla) => {
      if (tabla === 'turnos') {
        return {
          select() { return this; },
          eq() { return this; },
          order() { return this; },
          limit: async () => ({
            data: [
              {
                id_turno: 10,
                fecha_programada: '2026-10-13',
                inicio_desde: '08:00:00',
                hasta: '10:00:00',
                prioridad: 'P3_Casual',
                estado: 'Realizado',
                cobrado: false,
                id_presupuesto: 1,
                inmueble: {
                  direccion: 'Obispo Oro 433',
                  barrio: 'Nueva Córdoba',
                  latitud: -31.42,
                  longitud: -64.18,
                  cliente: { nombre: 'Jimena', apellido: 'Vedelago', telefono: '5493535653127' },
                },
                presupuesto: { id_presupuesto: 1, monto_total: 50000, estado: 'Aceptado' },
              },
              {
                id_turno: 11,
                fecha_programada: '2026-10-22',
                inicio_desde: '09:00:00',
                hasta: '11:00:00',
                prioridad: 'P2_Fijo',
                estado: 'Realizado',
                cobrado: false,
                id_presupuesto: 2,
                inmueble: {
                  direccion: 'Av. Colón 1000',
                  barrio: 'Centro',
                  cliente: { nombre: 'Pedro', apellido: 'Gómez', telefono: '5493510001111' },
                },
                presupuesto: { id_presupuesto: 2, monto_total: 30000, estado: 'Aceptado' },
              },
            ],
            error: null,
          }),
        };
      }
      if (tabla === 'trabajos_ejecutados') {
        return {
          select() { return this; },
          in: async () => ({
            data: [
              { id_trabajo: 101, id_turno: 10 },
              { id_trabajo: 102, id_turno: 11 },
            ],
            error: null,
          }),
        };
      }
      if (tabla === 'movimientos_cuenta') {
        return {
          select() { return this; },
          in: async () => ({
            data: [
              // Turno 10 debe 50000 y pagó 20000 -> saldo 30000
              { id_trabajo: 101, tipo: 'Debito', monto: 50000 },
              { id_trabajo: 101, tipo: 'Credito', monto: 20000 },
              // Turno 11 debe 30000 y pagó 30000 -> saldo 0 (se debe filtrar)
              { id_trabajo: 102, tipo: 'Debito', monto: 30000 },
              { id_trabajo: 102, tipo: 'Credito', monto: 30000 },
            ],
            error: null,
          }),
        };
      }
      throw new Error(`Tabla no esperada: ${tabla}`);
    },
  };

  const resultado = await obtenerTurnosPendientesCobro({ cliente: mockCliente });
  assert.equal(resultado.error, undefined);
  assert.equal(resultado.data.length, 1);
  assert.equal(resultado.data[0].id_turno, 10);
  assert.equal(resultado.data[0].cliente, 'Jimena Vedelago');
  assert.equal(resultado.data[0].saldo_pendiente, 30000);
  assert.equal(resultado.data[0].total_presupuestado, 50000);
  assert.ok(resultado.mensaje.includes('Jimena Vedelago'));
  assert.ok(resultado.mensaje.includes('30.000,00'));
});

test('obtenerTurnosPendientesCobro: si no hay turnos devuelve array vacio', async () => {
  const mockCliente = {
    from: () => ({
      select() { return this; },
      eq() { return this; },
      order() { return this; },
      limit: async () => ({ data: [], error: null }),
    }),
  };

  const resultado = await obtenerTurnosPendientesCobro({ cliente: mockCliente });
  assert.equal(resultado.error, undefined);
  assert.deepEqual(resultado.data, []);
  assert.equal(resultado.mensaje, 'No hay turnos realizados con saldo pendiente de cobro.');
});

test('obtenerTurnosPendientesCobro: error en base de turnos responde 500 seguro', async () => {
  const mockCliente = {
    from: () => ({
      select() { return this; },
      eq() { return this; },
      order() { return this; },
      limit: async () => ({ data: null, error: { message: 'DB down' } }),
    }),
  };

  const resultado = await obtenerTurnosPendientesCobro({ cliente: mockCliente });
  assert.equal(resultado.data, undefined);
  assert.equal(resultado.error.status, 500);
  assert.match(resultado.error.message, /No se pudieron consultar/);
});

// ---- Controller y Rutas -----------------------------------------------------

test('turnosPendientesCobroStaff: responde 200 con listado y mensaje', async (t) => {
  const { supabaseAdmin } = await import('../config/supabase.js');
  t.mock.method(supabaseAdmin, 'from', (tabla) => {
    if (tabla === 'turnos') {
      return {
        select() { return this; },
        eq() { return this; },
        order() { return this; },
        limit: async () => ({
          data: [
            {
              id_turno: 42,
              fecha_programada: '2026-11-01',
              inicio_desde: '10:00:00',
              hasta: '12:00:00',
              prioridad: 'P1_Reasignado',
              estado: 'Realizado',
              cobrado: false,
              id_presupuesto: 5,
              inmueble: {
                direccion: 'Bv. San Juan 500',
                barrio: 'Centro',
                latitud: null,
                longitud: null,
                cliente: { nombre: 'María', apellido: 'López', telefono: '549351444444' },
              },
              presupuesto: { id_presupuesto: 5, monto_total: 25000, estado: 'Aceptado' },
            },
          ],
          error: null,
        }),
      };
    }
    if (tabla === 'trabajos_ejecutados') {
      return {
        select() { return this; },
        in: async () => ({ data: [], error: null }),
      };
    }
    return {
      select() { return this; },
      in: async () => ({ data: [], error: null }),
    };
  });

  const res = respuesta();
  await turnosPendientesCobroStaff(
    {
      query: { limite: '10' },
      usuario: { id: 1 },
    },
    res
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.total, 1);
  assert.equal(res.body.data[0].id_turno, 42);
  assert.equal(res.body.data[0].saldo_pendiente, 25000);
  assert.ok(res.body.mensaje.includes('María López'));
});

test('bot.routes.js: expone la ruta /staff/:telefono/turnos/pendientes-cobro', () => {
  const rutas = botRoutes.stack
    .filter((layer) => layer.route)
    .map((layer) => ({
      path: layer.route.path,
      methods: Object.keys(layer.route.methods),
    }));

  const ruta = rutas.find((r) => r.path === '/staff/:telefono/turnos/pendientes-cobro');
  assert.ok(ruta, 'La ruta /staff/:telefono/turnos/pendientes-cobro debe estar registrada');
  assert.ok(ruta.methods.includes('get'));
});
