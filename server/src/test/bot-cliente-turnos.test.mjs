import test from 'node:test';
import assert from 'node:assert/strict';

// Cliente aislado: nunca usa las credenciales ni la base real del proyecto.
process.env.SUPABASE_URL = 'https://bot-cliente-turnos-tests.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'bot-cliente-turnos-tests-sin-conexion';

const { supabaseAdmin } = await import('../config/supabase.js');
const {
  ESTADOS_TURNOS_FUTUROS,
  armarMensajeTurnosFuturosCliente,
  obtenerTurnosFuturosCliente,
} = await import('../services/turnosClienteService.js');
const { getTurnosFuturosDelCliente } = await import('../controllers/botTurnosClienteController.js');
const { default: botRoutes } = await import('../routes/bot.routes.js');

const respuesta = () => {
  const res = { statusCode: null, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
};

const AHORA_FIJO = new Date('2026-11-03T15:00:00Z'); // 2026-11-03 en Argentina

// ---- armarMensajeTurnosFuturosCliente ---------------------------------------

test('armarMensajeTurnosFuturosCliente: sin turnos devuelve mensaje claro', () => {
  assert.equal(armarMensajeTurnosFuturosCliente([]), 'No tenés turnos futuros programados.');
});

test('armarMensajeTurnosFuturosCliente: formatea lista con fecha, horario, lugar, servicio y estado', () => {
  const msg = armarMensajeTurnosFuturosCliente([
    {
      id_turno: 10,
      fecha: '2026-11-05',
      hora_inicio: '08:30:00',
      hora_fin: '11:00:00',
      estado: 'Confirmado',
      direccion: 'Av. Colón 1234',
      barrio: 'Centro',
      servicio: 'Corte de césped',
    },
    {
      id_turno: 11,
      fecha: '2026-11-12',
      hora_inicio: null,
      hora_fin: null,
      estado: 'Coordinado',
      direccion: 'Belgrano 500',
      barrio: null,
      servicio: null,
    },
  ]);

  assert.match(msg, /Tenés 2 turnos programados:/);
  assert.match(msg, /1\. 05\/11 de 08:30 a 11:00 hs - Av\. Colón 1234, Centro \(Corte de césped\) \[Confirmado\]/);
  assert.match(msg, /2\. 12\/11 - Belgrano 500 \[Coordinado\]/);
});

// ---- obtenerTurnosFuturosCliente --------------------------------------------

test('obtenerTurnosFuturosCliente: rechaza idCliente o limite inválidos con 400', async () => {
  const sinCliente = await obtenerTurnosFuturosCliente({ idCliente: null });
  assert.equal(sinCliente.error.status, 400);

  const limiteInvalido = await obtenerTurnosFuturosCliente({ idCliente: 5, limite: 'abc' });
  assert.equal(limiteInvalido.error.status, 400);

  const limiteCero = await obtenerTurnosFuturosCliente({ idCliente: 5, limite: 0 });
  assert.equal(limiteCero.error.status, 400);
});

test('obtenerTurnosFuturosCliente: filtra por id_cliente, fecha >= hoy y estados vigentes, y adjunta servicios', async () => {
  const filtrosTurnos = [];
  const clienteMock = {
    from: (tabla) => {
      if (tabla === 'turnos') {
        const registrar = (op) => function (...args) { filtrosTurnos.push([op, ...args]); return this; };
        return {
          select() { return this; },
          eq: registrar('eq'),
          gte: registrar('gte'),
          in: registrar('in'),
          order: registrar('order'),
          limit: registrar('limit'),
          then(resolve) {
            return resolve({
              data: [
                {
                  id_turno: 21,
                  fecha_programada: '2026-11-04',
                  inicio_desde: '09:00:00',
                  hasta: '11:00:00',
                  estado: 'Confirmado',
                  id_presupuesto: 100,
                  inmueble: {
                    id_inmueble: 3,
                    id_cliente: 42,
                    direccion: 'San Martín 100',
                    barrio: 'Nueva Córdoba',
                  },
                },
                {
                  id_turno: 25,
                  fecha_programada: '2026-11-10',
                  inicio_desde: '14:00:00',
                  hasta: '16:00:00',
                  estado: 'Coordinado',
                  id_presupuesto: null,
                  inmueble: {
                    id_inmueble: 4,
                    id_cliente: 42,
                    direccion: 'Chacabuco 250',
                    barrio: null,
                  },
                },
              ],
              error: null,
            });
          },
        };
      }

      if (tabla === 'detalle_presupuesto') {
        return {
          select() { return this; },
          in(col, ids) {
            assert.equal(col, 'id_presupuesto');
            assert.deepEqual(ids, [100]);
            return Promise.resolve({
              data: [
                { id_presupuesto: 100, id_servicio: 1, servicio: { nombre: 'Corte de césped' } },
                { id_presupuesto: 100, id_servicio: 2, servicio: { nombre: 'Desmalezado' } },
              ],
              error: null,
            });
          },
        };
      }

      throw new Error(`Tabla no esperada: ${tabla}`);
    },
  };

  const resultado = await obtenerTurnosFuturosCliente({
    idCliente: 42,
    limite: '15',
    ahora: AHORA_FIJO,
    cliente: clienteMock,
  });

  assert.equal(resultado.error, undefined);
  assert.deepEqual(
    filtrosTurnos.find((f) => f[0] === 'eq'),
    ['eq', 'inmueble.id_cliente', 42]
  );
  assert.deepEqual(
    filtrosTurnos.find((f) => f[0] === 'gte'),
    ['gte', 'fecha_programada', '2026-11-03']
  );
  assert.deepEqual(
    filtrosTurnos.find((f) => f[0] === 'in'),
    ['in', 'estado', ESTADOS_TURNOS_FUTUROS]
  );
  assert.deepEqual(
    filtrosTurnos.find((f) => f[0] === 'limit'),
    ['limit', 15]
  );

  assert.equal(resultado.data.length, 2);
  assert.deepEqual(resultado.data[0], {
    id_turno: 21,
    fecha: '2026-11-04',
    hora_inicio: '09:00:00',
    hora_fin: '11:00:00',
    estado: 'Confirmado',
    id_inmueble: 3,
    direccion: 'San Martín 100',
    barrio: 'Nueva Córdoba',
    servicio: 'Corte de césped, Desmalezado',
    servicios: ['Corte de césped', 'Desmalezado'],
  });
  assert.equal(resultado.data[1].servicio, null);
  assert.deepEqual(resultado.data[1].servicios, []);
  assert.match(resultado.mensaje, /04\/11 de 09:00 a 11:00 hs/);
});

test('obtenerTurnosFuturosCliente: degrada sin romper si falla detalle_presupuesto', async () => {
  const clienteMock = {
    from: (tabla) => {
      if (tabla === 'turnos') {
        return {
          select() { return this; },
          eq() { return this; },
          gte() { return this; },
          in() { return this; },
          order() { return this; },
          limit() {
            return Promise.resolve({
              data: [
                {
                  id_turno: 30,
                  fecha_programada: '2026-11-06',
                  inicio_desde: '10:00:00',
                  hasta: '12:00:00',
                  estado: 'Coordinado',
                  id_presupuesto: 55,
                  inmueble: { id_inmueble: 8, id_cliente: 9, direccion: 'Salta 10', barrio: 'Centro' },
                },
              ],
              error: null,
            });
          },
        };
      }
      if (tabla === 'detalle_presupuesto') {
        return {
          select() { return this; },
          in() { return Promise.resolve({ data: null, error: { message: 'fallo db detalle' } }); },
        };
      }
      throw new Error(`Tabla no esperada: ${tabla}`);
    },
  };

  const resultado = await obtenerTurnosFuturosCliente({
    idCliente: 9,
    ahora: AHORA_FIJO,
    cliente: clienteMock,
  });

  assert.equal(resultado.error, undefined);
  assert.equal(resultado.data.length, 1);
  assert.equal(resultado.data[0].servicio, null);
});

test('obtenerTurnosFuturosCliente: devuelve 500 si falla la consulta de turnos', async () => {
  const clienteMock = {
    from: () => ({
      select() { return this; },
      eq() { return this; },
      gte() { return this; },
      in() { return this; },
      order() { return this; },
      limit() { return Promise.resolve({ data: null, error: { message: 'db caída' } }); },
    }),
  };

  const resultado = await obtenerTurnosFuturosCliente({
    idCliente: 9,
    ahora: AHORA_FIJO,
    cliente: clienteMock,
  });

  assert.equal(resultado.error.status, 500);
});

// ---- Controller y Ruta ------------------------------------------------------

test('getTurnosFuturosDelCliente: responde 200 con total, data y mensaje', async (t) => {
  t.mock.method(supabaseAdmin, 'from', (tabla) => {
    assert.equal(tabla, 'turnos');
    return {
      select() { return this; },
      eq() { return this; },
      gte() { return this; },
      in() { return this; },
      order() { return this; },
      limit() { return Promise.resolve({ data: [], error: null }); },
    };
  });

  const res = respuesta();
  await getTurnosFuturosDelCliente(
    { cliente: { id_cliente: 12 }, query: {} },
    res
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.total, 0);
  assert.deepEqual(res.body.data, []);
  assert.match(res.body.mensaje, /No tenés turnos futuros/);
});

test('bot.routes.js: registra GET /clientes/:telefono/turnos', () => {
  const rutas = botRoutes.stack
    .filter((layer) => layer.route)
    .map((layer) => ({
      path: layer.route.path,
      methods: Object.keys(layer.route.methods),
    }));

  const encontrada = rutas.find(
    (r) => r.path === '/clientes/:telefono/turnos' && r.methods.includes('get')
  );
  assert.ok(encontrada, 'Debe existir la ruta GET /clientes/:telefono/turnos');
});
